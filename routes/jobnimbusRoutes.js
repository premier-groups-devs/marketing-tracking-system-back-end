const express = require('express');
const router = express.Router();
const jobnimbusController = require('../controllers/jobnimbusController');
const five_minute_interval = parseInt(process.env.ONE_MINUTE_INTERVAl); // Convertir a número

router.get('/getContactsAll', jobnimbusController.getContactsAll);
router.get('/getContacts/:jnid', jobnimbusController.getContacts);
module.exports = router;

if (!isNaN(five_minute_interval)) {
    setInterval(() => {
        //jobnimbusController.getContactsInterval('m38x205m8tox6h7anm6hbcr');
    }, five_minute_interval); 
} else {
    console.error('INTJOBNIMBUS no está configurado correctamente en el archivo .env');
}
