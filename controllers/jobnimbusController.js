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
    , 'cf_string_10'
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
    , 'cf_double_19'
    , 'cf_double_8'
    , 'cf_string_15'
    , 'cf_double_5' // Valida monto de Signed Contract
    , 'cf_string_61' //Service Required
    , 'cf_boolean_11' //Valida Appointment Set
    , 'cf_date_7'  //Valida Demo Valid
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

exports.getContactsInterval = async (jnid, manualStartDate = null) => {
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
                            gte: startDateTimestamp, // Fecha de inicio (timestamp)
                            lte: Math.floor(Date.now() / 1000) //1731703899//Math.floor(Date.now() / 1000)  // Fecha de fin (timestamp actual)
                        }
                    }
                }
            ]
        });
       
        const response = await jobNimbusAPI.get(`/contacts/?filter=${filterQuery}`);
        const result = response.data;

        if(result.results && result.results.length > 0)
            await postSaveContacts(result.results);
        
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
                    if (key === 'cf_double_1' || key === 'cf_double_19' || key === 'cf_double_8' || key === 'cf_double_5' || key === 'cf_boolean_11' || key === 'last_estimate_date_created' || key==='last_estimate_date_estimate' || key==='last_invoice_date_created' || key==='last_invoice_date_invoice' || key==='cf_date_6' || key==='cf_date_7') {
                        obj[key] = 0; // Valor por defecto para campos numéricos
                    } else {
                        obj[key] = null; // Valor por defecto para otros campos
                    }
                }
                return obj;
            }, {});

            // Validar que source_name, status_name y location no sean nulos o vacíos
            if (!filteredContactData.source_name || !filteredContactData.status_name || !filteredContactData.location) {
                console.log('source_name, status_name o location son nulos o vacíos. No se guardará el contacto.');
                continue;
            } else {
                await validateInsertContactFiel(connection, filteredContactData.source_name, filteredContactData.location, filteredContactData.cf_string_61);
            }
          
            // Convert date_created from ISO timestamp to DATETIME format and save it in date_create
            if (filteredContactData.date_created) {
                filteredContactData.date_create = convertToDatetime(filteredContactData.date_created, -5); // Adjust for UTC-5
            }

            const checkQuery = `
                SELECT id
                FROM jobnimbus_contacts 
                WHERE jnid = ? 
            `;
            const [checkResult] = await connection.execute(checkQuery, [
                filteredContactData.jnid,
            ]);

            if (checkResult.length === 0) {
                console.log('El jnid no existe, insertando los datos.');
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
                        if (value === null) {
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

                const placeholders = columns.map(() => '?').join(', ');

                // Agregar console.log para columns y placeholders
                //console.log('Columns:', columns.join(', '));
                //console.log('Placeholders:', placeholders);

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
            WHERE status_name NOT IN (?, ?, ?)
            AND YEAR(date_create) >= ?
            AND is_active = ?
        `;
        const [contacts] = await connection.execute(query, [...excludedStatuses, new Date().getFullYear(), 1]);
        connection.release();

        const updateContact = async (contact) => {
            const { jnid, status_name: currentStatus, id, date_created } = contact;

            try {
                const response = await jobNimbusAPI.get(`/contacts/${jnid}`);
                const result = response.data;

                // Validar que source_name, status_name y location no sean nulos o vacíos
                if (!result.source_name || !result.status_name || !result.location) {
                    console.log('source_name, status_name o location son nulos o vacíos. No se actualizará el contacto.');
                    return;
                }

                if (result.status_name === 'Signed Contract' && (!result.cf_double_5 || result.cf_double_5 <= 0)) {
                    console.log(`El contacto con jnid ${jnid} tiene el estado 'Signed Contract' pero cf_double_5 es 0 o null. No se actualizará.`);
                    return;
                }

                // Check if the status has already been recorded in jobnimbus_contacts_status_historicals
                const historicalCheckQuery = `
                    SELECT status_name
                    FROM jobnimbus_contacts_status_historicals 
                    WHERE id_jobnimbus_contacts = ? 
                `;
                const [historicalCheckResult] = await connection.execute(historicalCheckQuery, [id]);
                
                if (result.cf_boolean_11 && !historicalCheckResult.some(record => record.status_name === 'Appointment Valid')) {
                    result.status_name = 'Appointment Valid';
                }

                if (result.cf_date_7 && !historicalCheckResult.some(record => record.status_name === 'Demo Valid')) {
                    result.status_name = 'Demo Valid';
                }

                if (result && result.status_name && !historicalCheckResult.some(record => record.status_name === result.status_name)) {
                    console.log(`Actualizando status_name para jnid: ${jnid}`);

                    const updateColumns = [];
                    const updateValues = [];

                    for (const key of allowedColumns) {
                        if (result.hasOwnProperty(key)) {
                            let value = result[key];
                            if (Array.isArray(value) || typeof value === 'object') {
                                value = JSON.stringify(value);
                            } else if (value === '') {
                                value = null;
                            }
                            updateColumns.push(`${key} = ?`);
                            updateValues.push(value);
                        }
                    }

                    // Ensure status_name is not null
                    /*if (!updateColumns.includes('status_name')) {
                        updateColumns.push('status_name');
                        updateValues.push(result.status_name || 'Unknown');
                    }*/

                    if (updateColumns.length > 0) {
                        //console.log('\x1b[33m%s\x1b[0m', 'Insert: ' + JSON.stringify(updateColumns));
                        //console.log('\x1b[32m%s\x1b[0m', 'Into: ' + JSON.stringify(updateValues));

                        // Convert date_created from ISO timestamp to DATETIME format and save it in date_create
                        const updateQuery = `
                            UPDATE jobnimbus_contacts 
                            SET ${updateColumns.join(', ')}, date_update = ?, date_create = ?
                            WHERE jnid = ?
                        `;
                        const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                        const adjustedDateCreate = date_created ? convertToDatetime(date_created, -5) : null; // Adjust for UTC-5
                        updateValues.push(currentDate, adjustedDateCreate, jnid);

                        connection = await db.getConnection();
                        await connection.execute(updateQuery, updateValues);
                    } else {
                        console.log(`No hay columnas para actualizar para el contacto con jnid ${jnid}`);
                    }

                    const historicalQuery = `
                        INSERT INTO jobnimbus_contacts_status_historicals (id_jobnimbus_contacts, status_name, date_create)
                        VALUES (?, ?, NOW())
                    `;
                    
                    await connection.execute(historicalQuery, [id, result.status_name || 'Unknown']);
                    connection.release();
                } else {
                    console.log(`No se necesita actualizar el contacto con jnid ${jnid}`);
                }
            } catch (error) {
                if (error.response && error.response.data === 'Not Found') {
                    console.log(`El contacto con jnid ${jnid} no se encontró. Marcándolo como inactivo.`);
                    await updateContactIsActive(connection, jnid);
                } else {
                    console.error(`Error al actualizar el contacto con jnid ${jnid}:`, error.response ? error.response.data : error.message);
                    logError(`Error al actualizar el contacto con jnid ${jnid}: ${error.response ? error.response.data : error.message}`);
                }
            }
        };

        await Promise.all(contacts.map(updateContact));
    } catch (error) {
        console.error('Error al obtener los contactos:', error.message);
        logError(`Error al obtener los contactos: ${error.message}`);
    } finally {
        isUpdatingProjects = false;
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
