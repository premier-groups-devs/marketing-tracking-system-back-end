const db = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { broadcastDashboard } = require('../services/websocket');
const { isTokenRevoked, revokedTokens } = require('../middlewares/authMiddleware'); // Importar el middleware
const one_minute_interval = parseInt(process.env.ONE_MINUTE_INTERVAl);  
const commercial_commissions = parseInt(process.env.COMMERCIAL_COMMISSIONS); 
const Residential_commissions = parseInt(process.env.RESIDENTIAL_COMMISSIONS);

let previousData = null;

exports.dashboard = async (req, res) => {
  console.log('en dashboard ***');  
  const token = req.cookies.token; 

  if (isTokenRevoked(token)) { 
    return res.status(401).json({ 
      success: false,
      message: "Token is revoked." 
    });
  }

  if (!token) {
    return res.status(400).json({ 
      success: false,
      message: "Token not found in cookie." 
    });
  }

  try {
    const dashboardData = await exports.getDashboardData(req.query.startDate, req.query.endDate, req.query.citys, req.query.invalid);
    //console.log('Imprimiendo: '+JSON.stringify(dashboardData))

    return res.status(200).json({
      success: true,
      message: 'Dashboard successful',
      result: dashboardData
    });
  } catch (error) {
    console.error('Error en la consulta:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message // Esto ayudará a identificar el error específico
    });
  }
};

exports.getDashboardData = async (startDate, endDate, citys, invalid) => {
  console.log('en getDashboardData ***');
  let connection;

  try {

    // Inicializa las variables para los estatus
    let arrayChannelMarketing = [];
    let arrayLeadMarketing = [];
    let arrayRevenueMarketing = [];
    let arrayCitys = [];
    connection = await db.getConnection();    
    //console.log('startDate: '+startDate+' endDate: '+endDate+' citys: '+citys);
    const [results] = await connection.query('CALL GetMarketingDashboardData(?, ?, ?, ?)', [startDate, endDate, citys, invalid]);

    if(results[0].length > 0)
      arrayChannelMarketing = results[0];

    if(results[1].length > 0) {
      arrayLeadMarketing = results[1].reduce((acc, item) => {
        const month = item.month; // Asegúrate de que 'month' es la propiedad correcta en tu objeto
        if (!acc[month]) {
          acc[month] = [];
        }
        acc[month].push({
          city: item.city_name,
          count: item.count,
          mount: item.mount,
          percentage: Number(item.percentage).toFixed(2),
          visible: true,
          colors_charts: item.colors_charts
        });
        return acc;
      }, {});
    }  

    if(results[2].length > 0) {
      arrayRevenueMarketing = results[2].reduce((acc, item) => {
        const month = item.month; // Asegúrate de que 'month' es la propiedad correcta en tu objeto
        if (!acc[month]) {
          acc[month] = [];
        }
        acc[month].push({
          city: item.city_name,
          count: item.count,
          mount: item.mount,
          percentage: Number(item.percentage).toFixed(2),
          visible: true,
          colors_charts: item.colors_charts
        });
        return acc;
      }, {});
    }  
    
    if(results[3].length > 0) 
      arrayCitys = results[3];

    return {
      arrayChannelMarketing: arrayChannelMarketing
      , arrayLeadMarketing: arrayLeadMarketing
      , arrayRevenueMarketing: arrayRevenueMarketing
      , arrayCitys: arrayCitys
    };
  } catch (error) {
    console.error('Error en la consulta:', error);
    throw error;
  } finally {
    if (connection) connection.release(); // Liberar conexión
  }
};

exports.processCityyGroupData = async (data) => {
  console.log('processCityyGroupData ***');
  let result = data.reduce((acc, item) => {
    acc[item.city] = {
      count: item.count
      , percentage: Number(item.percentage).toFixed(2)
      , visible: true
      , colors_charts: item.colors_charts
    };
    return acc;
  }, {});
  return result;
};

exports.processMonthlyGroupData = async (data, statusName) => {
  console.log('processMonthlyGroupData ***');  
  const selectObjectMonth = [];
  const filteredData = data.filter(contact => contact.status_name === statusName);
  const monthlyDataObj = filteredData.reduce((acc, item) => {
    let city = item.city;
    let month = item.month;
    if (!acc[month]) {
      acc[month] = {};
      selectObjectMonth.push(month);
    }
    if (city !== 'Unknown') {
      if (!acc[month][city]) {
        acc[month][city] = {
          count: 0,
          visible: true,
          colors_charts: item.colors_charts
        };
      }
      acc[month][city].count += item.count;
    }
    
    return acc;
  }, {});

  // Asegurar que todas las ciudades estén presentes en cada mes
  const allCities = new Set();
  Object.values(monthlyDataObj).forEach(monthData => {
    Object.keys(monthData).forEach(city => allCities.add(city));
  });

  selectObjectMonth.forEach(month => {
    if (!monthlyDataObj[month]) {
      monthlyDataObj[month] = {};
    }
    allCities.forEach(city => {
      if (!monthlyDataObj[month][city]) {
        // Encontrar el color de la ciudad de cualquier mes existente
        let cityColor = '';
        for (const monthData of Object.values(monthlyDataObj)) {
          if (monthData[city]) {
            cityColor = monthData[city].colors_charts;
            break;
          }
        }
        monthlyDataObj[month][city] = {
          count: 0,
          visible: true,
          colors_charts: cityColor
        };
      }
    });
  });
  return monthlyDataObj;
};

exports.hasDataChanged = async (newData) => { 
  if (!previousData) {
    //console.log('Inicializando previousData');
    previousData = newData;
    return true;
  }

  const dataChanged = JSON.stringify(previousData) !== JSON.stringify(newData);
  /*if (dataChanged) {
    console.log('Datos cambiaron');
    console.log('Datos anteriores:', JSON.stringify(previousData));
    console.log('Nuevos datos:', JSON.stringify(newData));
  } else {
    console.log('Datos no cambiaron');
  }*/

  return dataChanged;
};

exports.startDashboardMonitor = async () => {
  console.log('en startDashboardMonitor ***');
  setInterval(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;
      const citys = 0;
      const invalid = 0;
    
      const newData = await exports.getDashboardData(startDate, endDate, citys, invalid);
      if (await exports.hasDataChanged(newData)) {
        previousData = newData;
        broadcastDashboard({ message: true });
      }
    } catch (error) {
      console.error('Error monitoring dashboard data:', error);
    }
  }, one_minute_interval);
};

exports.startDashboardMonitor();