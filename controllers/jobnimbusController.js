require('dotenv').config();
const db = require('../models/db');
const axios = require('axios');

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
    , 'cf_double_5'
    , 'cf_string_61' // Service Required 
    , 'cf_boolean_11' // true Appointment Valid , false 
    , 'cf_date_7'   // Demo Completed
];

exports.getContactsInterval = async (jnid, manualStartDate = null) => {
    console.log('en getContactsInterval ***');

    if (isProcessing) {
        console.log('El proceso de inserción ya está en curso, esperando...');
        return;
    }

    isProcessing = true;
    try {

        let startDateTimestamp = manualStartDate ? manualStartDate : await getLastCreatedDate();
        //console.log('startDateTimestamp: '+startDateTimestamp+' - '+Math.floor(Date.now() / 1000) )
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
                obj[key] = contactData.hasOwnProperty(key) ? contactData[key] : null;
                return obj;
            }, {});

            // Validar que source_name, status_name y location no sean nulos o vacíos
            if (!filteredContactData.source_name || !filteredContactData.status_name || !filteredContactData.location) {
                console.log('source_name, status_name o location son nulos o vacíos. No se guardará el contacto.');
                continue;
            }

            // Convert date_created from ISO timestamp to DATETIME format and save it in date_create
            if (filteredContactData.date_created) {
                const date = new Date(filteredContactData.date_created * 1000);
                filteredContactData.date_create = date.toISOString().slice(0, 19).replace('T', ' ');
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
            SELECT jnid, status_name, id 
            FROM jobnimbus_contacts 
            WHERE status_name NOT IN (?, ?, ?)
            AND MONTH(date_created) = MONTH(CURRENT_DATE())
            AND YEAR(date_created) = YEAR(CURRENT_DATE())
        `;
        const [contacts] = await connection.execute(query, excludedStatuses);
        connection.release();

        const updateContact = async (contact) => {
            const { jnid, status_name: currentStatus, id } = contact;

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
                    if (!updateColumns.includes('status_name')) {
                        updateColumns.push('status_name');
                        updateValues.push(result.status_name || 'Unknown');
                    }

                    const updateQuery = `
                        UPDATE jobnimbus_contacts 
                        SET ${updateColumns.join(', ')}, date_updated = NOW()
                        WHERE jnid = ?
                    `;
                    updateValues.push(jnid);

                    connection = await db.getConnection();
                    await connection.execute(updateQuery, updateValues);

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
                console.error(`Error al actualizar el contacto con jnid ${jnid}:`, error.response ? error.response.data : error.message);
            }
        };

        await Promise.all(contacts.map(updateContact));
    } catch (error) {
        console.error('Error al obtener los contactos:', error.message);
    } finally {
        isUpdatingProjects = false;
    }
};

