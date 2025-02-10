const express = require('express');
const router = express.Router();
const jobnimbusController = require('../controllers/jobnimbusController');
const five_minute_interval = parseInt(process.env.ONE_MINUTE_INTERVAl); // Convertir a número

// Define your routes here
//router.get('/contacts', jobnimbusController.getContactsAll);
//router.get('/contacts/:jnid', jobnimbusController.getContacts);
//router.get('/contacts-interval', jobnimbusController.getContactsInterval);

// Add any other routes as needed
// router.get('/some-other-route', jobnimbusController.someOtherFunction);

module.exports = router;

if (!isNaN(five_minute_interval)) {
    setInterval(() => {
        //jobnimbusController.getContactsInterval('m3j7sg8dy3hkb13ej5obpbc',1553810955);
        //jobnimbusController.updateProjects();
    }, five_minute_interval); 
} else {
    console.error('INTJOBNIMBUS no está configurado correctamente en el archivo .env');
}
