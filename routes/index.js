const express = require('express');
const userRoutes = require('./userRoutes');
const jobnimbusRoutes = require('./jobnimbusRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Importar el middleware

const router = express.Router();
router.use('/users', userRoutes);
router.use('/jobnimbus', jobnimbusRoutes);
router.use('/dashboards', dashboardRoutes);

module.exports = router;
