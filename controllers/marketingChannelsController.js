const dotenv = require('dotenv');
const moment = require('moment'); 
const db = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { isTokenRevoked, revokedTokens} = require('../middlewares/authMiddleware'); // Importar el middleware

exports.marketingChannelsList = async (req, res) => {
  console.log('en marketingChannelsList ***');
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

  let connection;
  try {
    connection = await db.getConnection();
    const [marketingChannel] = await connection.query('CALL GetMarketingChannelsList()');
    res.status(200).json({
      success: true,
      message: 'Marketing channels list successful',
      result: {
        arrayMarketingChannels: marketingChannel[0],
        arrayCitys: marketingChannel[1],
      }
    });
  } catch (err) {
    console.error('Error en la consulta:', err);
    res.status(500).json({ success: false, message: 'Marketing channels list errors', error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.MarketingChannelsRegister = async (req, res) => {
  console.log('en MarketingChannelsRegister ***');
  let connection;
  try {
    const { source_name, cost, id, insert, id_city, date_create } = req.body;
    
    if (!req.body.id) {
      req.body.id = null;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array()[0].msg });
    }

    connection = await db.getConnection();
    const [result] = await connection.query(
      'CALL RegisterOrEditMarketingChannels(?, ?, ?, ?, ?, ?)',
      [source_name, cost, id, insert, id_city, date_create]
    );

    res.status(200).json({
      success: true,
      message: id ? 'Marketing channels updated successfully' : 'Marketing channels registered successfully',
      result: result[0]
    });
  } catch (err) {
    console.error('Error al registrar o editar marketing channels:', err);
    res.status(500).json({ message: 'Error al registrar o editar marketing channels' });
  } finally {
    if (connection) connection.release(); // Liberar conexión
  }
};

exports.toggleMarketingChannelsStatus = async (req, res) => {
  console.log('en toggleMarketingChannelsStatus ***');
  const token = req.cookies.token; 

  if (isTokenRevoked(token)) { 
    return res.status(401).json({ 
      success: false,
      message: "Token is revoked." 
    });
  }

  const { id_marketing_channel } = req.params;
  const { is_active } = req.body;
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array()[0].msg });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.query('CALL ToggleMarketingChannelsStatus(?, ?)', [id_marketing_channel, is_active]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Marketing channels not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Marketing channels status updated successfully' 
    });
  } catch (err) {
    console.error('Error al actualizar el estado del Marketing channels:', err);
    res.status(500).json({ message: 'Error al actualizar el estado del Marketing channels' });
  } finally {
    if (connection) connection.release(); // Liberar conexión
  }
};