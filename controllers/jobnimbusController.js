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

exports.getContactsAll = async (req, res) => {
    console.log('en getContactsAll ***');
    try {
        const filterQuery = JSON.stringify({
            should: [
                { term: { status_name: "Appointment Scheduled" } },
                { term: { status_name: "Signed Contract" } }
            ]
        });

        const response = await jobNimbusAPI.get(`/contacts/?filter=${filterQuery}`);
        const result = response.data;
        const filteredCount = result.results.length;

        res.json({
            filteredCount: filteredCount,
            filteredResults: result.results       
        });
    } catch (error) {
        console.error('Error al obtener contratos firmados:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error al obtener contratos firmados' });
    }
};

exports.getContacts = async (req, res) => {
    console.log('en getContacts ***', req.params.jnid); 
    try {
        const response = await jobNimbusAPI.get(`/contacts/${req.params.jnid}`);
        const result = response.data;
        
        if (result && result.status_name) {
            if (result && ["Appointment Scheduled", "Signed Contract", "Active"].includes(result.status_name)) {
                res.json({
                    filteredCount: 1,
                    filteredResults: [result] 
                });
            } else {
                res.json({
                    filteredCount: 0,
                    filteredResults: []
                });
            }
        } else {
            console.error('La respuesta no contiene un estado válido:', result);
            res.status(404).json({ error: 'El contacto no tiene un estado válido' });
        }
    } catch (error) {
        console.error('Error al obtener contrato:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error al obtener contrato' });
    }
};

exports.getContactsInterval = async (jnid) => {
    console.log('en getContactsInterval ***');

    if (isProcessing) {
        console.log('El proceso de inserción ya está en curso, esperando...');
        return;
    }

    isProcessing = true;
    try {

        const filterQuery = JSON.stringify({
            must: [
                { term: { status_name: "Sign PA Contract" } },
                //{ term: { status_name: "Appointment Scheduled" } },
                //{ term: { status_name: "Fresh lead" } },
                //{ term: { status_name: "Invalid" } }
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
        ];

        for (const contactData of contactDataArray) {
            const filteredContactData = allowedColumns.reduce((obj, key) => {
                obj[key] = contactData.hasOwnProperty(key) ? contactData[key] : null;
                return obj;
            }, {});

            const checkQuery = `
                SELECT id
                FROM jobnimbus_contacts 
                WHERE jnid = ? 
            `;
            const [checkResult] = await connection.execute(checkQuery, [
                filteredContactData.jnid,
            ]);


            if (checkResult.length > 0) {
                const idContact = checkResult[0].id;
                console.log('El jnid ya existe, actualizando los datos con id_contact:', idContact);

                const updateColumns = [];
                const updateValues = [];

                for (const key in filteredContactData) {
                    if (filteredContactData.hasOwnProperty(key)) {
                        let value = filteredContactData[key];
                        if (Array.isArray(value) || typeof value === 'object') {
                            value = JSON.stringify(value);
                        } else if (value === '') {
                            value = null;
                        }
                        updateColumns.push(`${key} = ?`);
                        updateValues.push(value);
                    }
                }

                const updateQuery = `
                    UPDATE jobnimbus_contacts 
                    SET ${updateColumns.join(', ')} 
                    WHERE id = ?
                `;
                updateValues.push(idContact);

                //console.log('Update Query:', updateQuery);
                //console.log('Update Values:', updateValues);

                await connection.execute(updateQuery, updateValues);
                //console.log(`Datos actualizados correctamente en la base de datos para id_contact: ${idContact}`);
            } else {
                //console.log('El jnid no existe, insertando los datos.');
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

                const placeholders = columns.map(() => '?').join(', ');

                const insertQuery = `
                    INSERT INTO jobnimbus_contacts (${columns.join(', ')})
                    VALUES (${placeholders})
                `;

                //console.log('Insert Query:', insertQuery);
                //console.log('Insert Values:', values);

                await connection.execute(insertQuery, values);
                //console.log('Datos guardados correctamente en la base de datos');
            }
        }
    } catch (error) {
        console.error('Error al guardar o actualizar los datos en la base de datos:', error.message);
    } finally {
        if (connection) connection.release(); 
    }
}