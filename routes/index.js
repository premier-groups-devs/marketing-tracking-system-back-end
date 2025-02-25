const express = require('express');
const userRoutes = require('./userRoutes');
const jobnimbusRoutes = require('./jobnimbusRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const marketingChannelsRoutes = require('./marketingChannelsRoutes');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Importar el middleware

const router = express.Router();
router.use('/users', userRoutes);
router.use('/jobnimbus', jobnimbusRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/marketing-channels', marketingChannelsRoutes);

module.exports = router;
