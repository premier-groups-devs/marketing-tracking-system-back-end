const express = require('express');
const router = express.Router();
const jobnimbusController = require('../controllers/jobnimbusController');
const five_minute_interval = parseInt(process.env.ONE_MINUTE_INTERVAl); // Convertir a número
const one_hour_interval = parseInt(process.env.ONE_HOUR_INTERVAL); // Convertir a número

// Define your routes here
//router.get('/contacts', jobnimbusController.getContactsAll);
//router.get('/contacts/:jnid', jobnimbusController.getContacts);
//router.get('/contacts-interval', jobnimbusController.getContactsInterval);

// Add any other routes as needed
// router.get('/some-other-route', jobnimbusController.someOtherFunction);

module.exports = router;

if (!isNaN(one_hour_interval)) {
    setInterval(() => {
        jobnimbusController.getContactsInterval('m3j7sg8dy3hkb13ej5obpbc','');
        //jobnimbusController.updateProjects();
    }, 1000/*one_hour_interval*/); 
} else {
    console.error('INTJOBNIMBUS no está configurado correctamente en el archivo .env');
}
