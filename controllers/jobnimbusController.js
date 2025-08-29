require('dotenv').config();
const db = require('../models/db');
const axios = require('axios');
const { Console } = require('console');
const fs = require('fs');
const path = require('path');

const jobNimbusAPI = axios.create({
    baseURL: 'https://app.jobnimbus.com/api1',
    headers: {
        'Authorization': `bearer ${process.env.JOBNIMBUS_API_KEY}`,  // Usa tu clave de API aquí
        'Content-Type': 'application/json'
    },
    maxBodyLength: Infinity,  // Permitir respuestas grandes
    maxContentLength: Infinity  // Permitir contenido de gran tamaño
});

let isProcessing = false;
let isUpdatingProjects = false;

const allowedColumns = [
    'first_name'
    , 'last_name'
    , 'email'
    , 'phone'
    , 'home_phone'
    , 'mobile_phone'
    , 'address_line1'
    , 'address_line2'
    , 'city'
    , 'state_text'
    , 'zip'
    , 'company'
    , 'country_name'
    , 'approved_estimate_total'
    , 'approved_invoice_total'
    , 'last_estimate'
    , 'approved_invoice_due'
    , 'status_name'
    , 'cf_string_10'    //Work Type
    , 'sales_rep_name'
    , 'sales_rep'
    , 'record_type_name'
    , 'source_name'
    , 'source'
    , 'tags'
    , 'location'
    , 'date_created'
    , 'date_updated'
    , 'cf_string_24'
    , 'jnid'
    , 'display_name'
    , 'cf_string_26'
    , 'last_estimate_date_created'
    , 'last_estimate_date_estimate'
    , 'last_estimate_jnid'
    , 'last_estimate_number'
    , 'last_invoice'
    , 'last_invoice_date_created'
    , 'last_invoice_date_invoice'
    , 'last_invoice_jnid'
    , 'last_invoice_number'
    , 'cf_date_6'
    , 'cf_string_53'
    , 'cf_string_54'
    , 'cf_double_1'
    , 'cf_double_19' //Contingency Amount
    , 'cf_double_8'
    , 'cf_string_15'
    , 'cf_double_5' // Valida monto de Signed Contract
    , 'cf_string_61' //Service Required
    , 'cf_boolean_11' //Valida Appointment Set
    , 'cf_date_7'  //Valida Demo Valid
    , 'cf_double_7' //Change of Order #1 Amount
    , 'cf_double_14' //Change of Order #2 Amount
    , 'cf_double_15' //Change of Order #3 Amount
    , 'cf_date_8' //Change of Order #1 Date
    , 'cf_date_12' //Change of Order #2 Date
    , 'cf_date_18' //Change of Order #3 Date
    , 'cf_string_37' //Roof type
    , 'cf_string_21' //Estimator
    , 'cf_date_24' //App Set On
    , 'cf_date_19' //Contract Signed Date
    , 'cf_double_2' //Scope (RCV)
    , 'cf_string_73' //Roof Type (Not to use)
    , 'cf_date_2' //PA Contract Signed
    , 'cf_double_24' //Change of Order #4 Amount
    , 'cf_double_25' //Change of Order #5 Amount
    , 'cf_double_26' //Change of Order #6 Amount
    , 'cf_date_27' //Change of Order #4 Date
    , 'cf_date_28' //Change of Order #5 Date
    , 'cf_date_29' //Change of Order #6 Date
];

const logFilePath = path.join(__dirname, '../../logs/error.log');

// Crear la carpeta logs si no existe
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

const logError = (message) => {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage);
};

exports.getContactsInterval = async (manualStartDate = null) => {
    console.log('en getContactsInterval ***');

    if (isProcessing) {
        console.log('El proceso de inserción ya está en curso, esperando...');
        return;
    }

    isProcessing = true;
    try {

        let startDateTimestamp = manualStartDate ? manualStartDate : await getLastCreatedDate();
        if (!startDateTimestamp) {
            console.log('No se encontró una fecha en la base de datos y no se proporcionó una fecha manual.');
            return;
        }

        const filterQuery = JSON.stringify({
            must: [
                {
                    range: {
                        date_created: {
                            gte: startDateTimestamp, // Fecha de inicio (timestamp), cada 6000 es 10 minutes
                            lte: Math.floor(Date.now() / 1000) //Math.floor(Date.now() / 1000)  // Fecha de fin (timestamp actual)
                        }
                    }
                }
            ]
        });

        const response = await jobNimbusAPI.get(`/contacts/?filter=${filterQuery}`);
        const result = response.data;

        response.data.results.forEach(contact => {
            console.log(`Nuevo contacto encontrado: ${contact.display_name}`);
        });

        if (result.results && result.results.length > 0) {
            await postSaveContacts(result.results);
        } else {
            console.log('No se encontraron nuevos contactos en JobNimbus.');
        }

    } catch (error) {
        console.error('Error al obtener el contrato:', error.response ? error.response.data : error.message);
        logError(`Error al obtener el contrato: ${error.response ? error.response.data : error.message}`);
    } finally {
        isProcessing = false;
        console.log('Proceso de inserción terminado.');
    }
};

async function postSaveContacts(contactDataArray) {
    console.log('en postSaveContacts ***');
    let connection;

    if (!Array.isArray(contactDataArray) || contactDataArray.length === 0) {
        console.log("El arreglo contactDataArray está vacío o no es un arreglo válido.");
        return;
    }

    try {
        connection = await db.getConnection();

        for (const contactData of contactDataArray) {
            const filteredContactData = allowedColumns.reduce((obj, key) => {
                if (contactData.hasOwnProperty(key)) {
                    obj[key] = contactData[key];
                } else {
                    // Asignar valores por defecto para los campos faltantes
                    if (key === 'cf_double_1' || key === 'cf_double_19' || key === 'cf_double_8' || key === 'cf_double_5' || key === 'cf_boolean_11' || key === 'last_estimate_date_created' || key === 'last_estimate_date_estimate' || key === 'last_invoice_date_created' || key === 'last_invoice_date_invoice' || key === 'cf_date_6' || key === 'cf_date_7') {
                        obj[key] = 0; // Valor por defecto para campos numéricos
                    } else {
                        obj[key] = null; // Valor por defecto para otros campos
                    }
                }
                return obj;
            }, {});

            //TODO VALIDAR QUE CAMPOS ADICIONALES SON NECESARIOS QUE NO SEAN NULOS 
            /*
            // Validar que source_name, status_name y location no sean nulos o vacíos
            if (!filteredContactData.source_name || !filteredContactData.status_name || !filteredContactData.location) {
                console.log(`El contacto con jnid ${filteredContactData.jnid} tiene source_name, status_name o location nulos o vacíos. No se guardará el contacto.`);
                continue;
            } else {
                //TODO query validateInsertContactFiel y adjust_id_company en mysql
                //await validateInsertContactFiel(connection, filteredContactData.source_name, filteredContactData.location, filteredContactData.cf_string_61);
                //filteredContactData.id_company = await getAdjustedIdCompany(connection, filteredContactData.source_name);
            }
            */

            // Convert date_created from ISO timestamp to DATETIME format and save it in date_create
            if (filteredContactData.date_created) {
                filteredContactData.date_create = convertToDatetime(filteredContactData.date_created, -5); // Adjust for UTC-5
            }

            const checkQuery = `
                SELECT id, display_name, email
                FROM jobnimbus_contacts
                WHERE jnid = ?
            `;
            const [checkResult] = await connection.execute(checkQuery, [
                filteredContactData.jnid,
            ]);

            if (checkResult.length === 0) {
                console.log(`El jnid ${filteredContactData.jnid} - ${filteredContactData.display_name} no existe, insertando los datos.`);
                const columns = [];
                const values = [];

                for (const key in filteredContactData) {
                    if (filteredContactData.hasOwnProperty(key)) {
                        let value = filteredContactData[key];
                        if (Array.isArray(value) || typeof value === 'object') {
                            value = JSON.stringify(value);
                        } else if (value === '') {
                            value = null;
                        } else if (typeof value === 'number' && isNaN(value)) {
                            value = 0; // Manejar valores NaN convirtiéndolos a 0
                        } else if (value === null && key.startsWith('cf_double_')) {
                            value = 0; // Convertir null a 0 para columnas numéricas
                        } else if (value === null && key.startsWith('cf_boolean_')) {
                            value = 0; // Convertir null a 0 para columnas booleanas
                        }

                        // Asegurar que los valores nulos no se pasen como 'null' (cadena)
                        if (value === 'null' || value === 'undefined' || value === '') {
                            value = null; // Opcional: si MySQL soporta NULL directo en la consulta
                        }

                        columns.push(key);
                        values.push(value);
                    }
                }

                // Ensure date_create is not added twice
                if (!columns.includes('date_create')) {
                    columns.push('date_create');
                    values.push(filteredContactData.date_create);
                }

                // Ensure status_name is not null
                if (!columns.includes('status_name')) {
                    columns.push('status_name');
                    values.push(filteredContactData.status_name || 'Unknown');
                }

                //TODO evaluate if is necessary to add id_company
                // // Ensure id_company is included
                // if (!columns.includes('id_company')) {
                //     columns.push('id_company');
                //     values.push(filteredContactData.id_company || 0);
                // }

                const placeholders = columns.map(() => '?').join(', ');

                const insertQuery = `
                    INSERT INTO jobnimbus_contacts (${columns.join(', ')})
                    VALUES (${placeholders})
                `;

                const [insertResult] = await connection.execute(insertQuery, values);
                const insertedId = insertResult.insertId;

                // Insert into jobnimbus_contacts_status_historicals
                const historicalQuery = `
                    INSERT INTO jobnimbus_contacts_status_historicals (id_jobnimbus_contacts, status_name, date_create)
                    VALUES (?, ?, ?)
                `;
                await connection.execute(historicalQuery, [insertedId, filteredContactData.status_name || 'Unknown', filteredContactData.date_create]);
            }
            /* else {
                console.log(`El jnid ${filteredContactData.jnid} existe (${checkResult.id}, ${checkResult.display_name}, ${checkResult.email}) actualizando los datos si es necesario.`);
                // Si no se insertó un nuevo contacto, se puede actualizar el existente
                const updateQuery = `
                     UPDATE jobnimbus_contacts
                     SET ${columns.map((col, index) => `${col} = ?`).join(', ')}
                     WHERE id = ?
                 `;
                await connection.execute(updateQuery, [...values, filteredContactData.id]);
            } */
        }
    } catch (error) {
        console.error('Error al guardar o actualizar los datos en la base de datos:', error.message);
        logError(`Error al guardar o actualizar los datos en la base de datos: ${error.message}`);
    } finally {
        if (connection) connection.release();
    }
}

const getLastCreatedDate = async () => {
    console.log('en getLastCreatedDate ***');
    let connection;
    try {
        connection = await db.getConnection();
        const query = 'SELECT MAX(date_created) as startDate FROM jobnimbus_contacts';
        const [result] = await connection.execute(query);
        connection.release();

        if (result.length > 0 && result[0].startDate) {
            return result[0].startDate;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error al obtener la última fecha de creación:', error.message);
        logError(`Error al obtener la última fecha de creación: ${error.message}`);
        return null;
    }
};

exports.updateProjects = async () => {
    console.log('en updateProjects ***');

    if (isUpdatingProjects) {
        console.log('El proceso de actualización ya está en curso, esperando...');
        return;
    }

    isUpdatingProjects = true;
    try {
        let connection = await db.getConnection();
        const excludedStatuses = ['Invalid', 'Unresponsive', 'Lost Sales'];
        const query = `
            SELECT jnid, status_name, id, date_created  
            FROM jobnimbus_contacts 
            WHERE is_active = ?
        `;
        // -- AND date_create BETWEEN '2025-06-10' AND '2025-06-20'

        const [contacts] = await connection.execute(query, [1]);
        connection.release();
        console.log(`Se encontraron ${contacts.length} contactos para actualizar.`);

        const updateContact = async (current) => {
            try {
                //Get the current contact details in JB
                const response = await jobNimbusAPI.get(`/contacts/${current.jnid}`);
                const result = response.data;

                // Validar que source_name, status_name y location no sean nulos o vacíos
                if (!result.source_name || !result.status_name || !result.location) {
                    console.log(`El contacto con jnid ${result.jnid} tiene source_name, status_name o location nulos o vacíos. No se actualizará el contacto.`);
                    return;
                }

                if (result.status_name === 'Signed Contract' && (!result.cf_double_5 || result.cf_double_5 <= 0)) {
                    console.log(`El contacto con jnid ${result.jnid} tiene el estado 'Signed Contract' pero cf_double_5 es 0 o null. No se actualizará.`);
                    return;
                }

                // Check if the status has already been recorded in jobnimbus_contacts_status_historicals
                const historicalCheckQuery = `
                    SELECT status_name
                    FROM jobnimbus_contacts_status_historicals 
                    WHERE id_jobnimbus_contacts = ? 
                `;

                const [historicalCheckResult] = await connection.execute(historicalCheckQuery, [current.id]);

                if (result.cf_boolean_11 && !historicalCheckResult.some(record => record.status_name === 'Appointment Valid')) {
                    result.status_name = 'Appointment Valid';
                }

                if (result.cf_date_7 && !historicalCheckResult.some(record => record.status_name === 'Demo Valid')) {
                    result.status_name = 'Demo Valid';
                }

                //Update contacts in our BD using the last data from JobNimbus
                const updateColumns = [];
                const updateValues = [];

                for (const key of allowedColumns) {
                    if (result.hasOwnProperty(key)) {
                        let value = result[key];
                        if (Array.isArray(value) || typeof value === 'object') {
                            value = JSON.stringify(value);
                        } else if (value === '') {
                            value = null;
                        } else if (typeof value === 'number' && isNaN(value)) {
                            value = 0; // Manejar valores NaN convirtiéndolos a 0
                        } else if (value === null && key.startsWith('cf_double_')) {
                            value = 0; // Convertir null a 0 para columnas numéricas
                        } else if (value === null && key.startsWith('cf_boolean_')) {
                            value = 0; // Convertir null a 0 para columnas booleanas
                        }

                        // Asegurar que los valores nulos no se pasen como 'null' (cadena)
                        if (value === 'null' || value === 'undefined' || value === '') {
                            value = null; // Opcional: si MySQL soporta NULL directo en la consulta
                        }

                        updateColumns.push(`${key} = ?`);
                        updateValues.push(value);
                    }
                }

                // Convert date_created from ISO timestamp to DATETIME format and save it in date_create
                const updateQuery = `
                            UPDATE jobnimbus_contacts 
                            SET ${updateColumns.join(', ')}, date_update = ?, date_create = ?
                            WHERE jnid = ?
                        `;
                const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                const adjustedDateCreate = current.date_created ? convertToDatetime(current.date_created, -5) : null; // Adjust for UTC-5
                updateValues.push(currentDate, adjustedDateCreate, current.jnid);

                connection = await db.getConnection();
                await connection.execute(updateQuery, updateValues);
                connection.release();

                //Only insert a new historical if it is a new/changed status
                if (result && result.status_name && !historicalCheckResult.some(record => record.status_name === result.status_name)) {
                    //TODO HISTORICAL OF CONTACTS SHOULD CONSIDER MORE FIELDS
                    const historicalQuery = `
                        INSERT INTO jobnimbus_contacts_status_historicals (id_jobnimbus_contacts, status_name, date_create)
                        VALUES (?, ?, NOW())`;

                    connection = await db.getConnection();
                    await connection.execute(historicalQuery, [current.id, result.status_name || 'Unknown']);
                    connection.release();
                    console.log(`Histórico de estado insertado para jnid ${current.jnid} con estado ${result.status_name}.`);
                }
            } catch (error) {
                if (error.response && error.response.data === 'Not Found') {
                    // TODO make procedure in BD to change inactive status
                    // console.log(`El contacto con jnid ${current.jnid} no se encontró. Marcándolo como inactivo.`);
                    // await updateContactIsActive(connection, current.jnid);
                } else {
                    console.error(`Error al actualizar el contacto con jnid ${current.jnid}:`, error.response ? error.response.data : error.message);
                    logError(`Error al actualizar el contacto con jnid ${current.jnid}: ${error.response ? error.response.data : error.message}`);
                }
            }
        };

        await Promise.all(contacts.map(updateContact));
    } catch (error) {
        console.error('Error al obtener los contactos:', error.message);
        logError(`Error al obtener los contactos: ${error.message}`);
    } finally {
        console.log('Finalizando la actualización de contactos...');
        isUpdatingProjects = false;
    }
};

exports.updateExistingContactsIdCompany = async () => {
    console.log('Iniciando la actualización de id_company para registros existentes...');
    let connection;

    try {
        connection = await db.getConnection();

        // Obtener todos los registros existentes en jobnimbus_contacts
        const [contacts] = await connection.execute(`
            SELECT id, source_name
            FROM jobnimbus_contacts
            WHERE id_company IS NULL OR id_company = 0
        `);

        if (contacts.length === 0) {
            console.log('No hay registros pendientes de actualizar.');
            return;
        }

        for (const contact of contacts) {
            const { id, source_name } = contact;

            if (!source_name) {
                console.log(`El contacto con ID ${id} no tiene source_name. Saltando...`);
                continue;
            }

            try {
                // Llamar al procedimiento almacenado para ajustar el id_company
                const adjustedIdCompany = await getAdjustedIdCompany(connection, source_name);

                // Actualizar el registro con el id_company ajustado
                await connection.execute(`
                    UPDATE jobnimbus_contacts
                    SET id_company = ?
                    WHERE id = ?
                `, [adjustedIdCompany, id]);

                console.log(`Registro con ID ${id} actualizado con id_company = ${adjustedIdCompany}`);
            } catch (error) {
                console.error(`Error al ajustar id_company para el contacto con ID ${id}:`, error.message);
                logError(`Error al ajustar id_company para el contacto con ID ${id}: ${error.message}`);
            }
        }

        console.log('Actualización de id_company completada.');
    } catch (error) {
        console.error('Error al actualizar id_company para registros existentes:', error.message);
        logError(`Error al actualizar id_company para registros existentes: ${error.message}`);
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Converts a UNIX timestamp to a DATETIME string in a specific timezone.
 * @param {number} unixTimestamp - The UNIX timestamp in seconds.
 * @param {number} offsetHours - The timezone offset in hours (e.g., -5 for UTC-5).
 * @returns {string} - The formatted DATETIME string.
 */
const convertToDatetime = (unixTimestamp, offsetHours = 0) => {
    const timestamp = unixTimestamp * 1000; // Convert seconds to milliseconds
    const dateUTC = new Date(timestamp); // Create UTC date
    const adjustedDate = new Date(dateUTC.getTime() + offsetHours * 3600 * 1000); // Adjust for timezone
    return adjustedDate.toISOString().slice(0, 19).replace('T', ' ');
};

async function validateInsertContactFiel(connection, sourceName, id_location_jobnimbus, serviceRequired) {
    try {
        const idLocation = typeof id_location_jobnimbus === 'object' && id_location_jobnimbus !== null && 'id' in id_location_jobnimbus
            ? id_location_jobnimbus.id
            : id_location_jobnimbus;

        const [rows] = await connection.execute('CALL validateInsertContactFiel(?, ?, ?)', [sourceName, idLocation, serviceRequired]);
    } catch (error) {
        console.error('Error al validar o insertar source_name o location:', error.message);
        throw error;
    }
}

const updateContactIsActive = async (connection, jnid) => {
    try {
        const [rows] = await connection.execute('CALL updateContactIsActive(?)', [jnid]);
        console.log(`El contacto con jnid ${jnid} se marcó como inactivo (is_active = 0) usando el procedimiento almacenado.`);
    } catch (error) {
        console.error(`Error al actualizar is_active para el contacto con jnid ${jnid}:`, error.message);
        logError(`Error al actualizar is_active para el contacto con jnid ${jnid}: ${error.message}`);
    }
};

const getAdjustedIdCompany = async (connection, source_name) => {
    try {
        const [result] = await connection.execute(`
            CALL adjust_id_company(?, @adjusted_id_company)
        `, [source_name]);

        // Obtener el valor ajustado de id_company
        const [adjustedResult] = await connection.execute(`
            SELECT @adjusted_id_company AS id_company
        `);
        return adjustedResult[0].id_company;
    } catch (error) {
        console.error(`Error al ajustar id_company para source_name ${source_name}:`, error.message);
        logError(`Error al ajustar id_company para source_name ${source_name}: ${error.message}`);
        throw error;
    }
};


