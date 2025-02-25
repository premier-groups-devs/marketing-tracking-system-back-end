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
        arrayMarketingChannel: marketingChannel[0],
      }
    });
  } catch (err) {
    console.error('Error en la consulta:', err);
    res.status(500).json({ success: false, message: 'Marketing channels list errors', error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.userRegister = async (req, res) => {
  console.log('en userRegister ***');
  let connection;
  try {
    const { full_name, email, username, id_company, password, id_user } = req.body;
    if (!req.body.id_user) {
      req.body.id_user = null;
    }
    
    const [name, last_name] = full_name.split(' ');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array()[0].msg });
    }

    connection = await db.getConnection();
    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }
    
    const [result] = await connection.query(
      'CALL RegisterOrEditUser(?, ?, ?, ?, ?, ?, ?)',
      [name, last_name, email, username, id_company, hashedPassword, id_user]
    );

    res.status(200).json({
      success: true,
      message: id_user ? 'User updated successfully' : 'User registered successfully',
      result: result[0]
    });
  } catch (err) {
    console.error('Error al registrar o editar usuario:', err);
    res.status(500).json({ message: 'Error al registrar o editar usuario' });
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