const dotenv = require('dotenv');
const moment = require('moment'); 
const db = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { isTokenRevoked, revokedTokens} = require('../middlewares/authMiddleware'); // Importar el middleware
const one_hour_interval = parseInt(process.env.ONE_HOUR_INTERVAL); 

// Registro de usuario
exports.registerUser = async (req, res) => {
  console.log('en registerUser ***');

  let connection;
  try {
    const { username, email, password } = req.body;

    // Validar resultados de la validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array()[0].msg });
    }

    // Conectar a la base de datos
    connection = await db.getConnection();

    // Verificar si el nombre de usuario ya existe
    const [existingUser] = await connection.query('SELECT * FROM user WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar usuario en la base de datos
    const [result] = await connection.query(
      'INSERT INTO user (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    res.status(201).json({ id: result.insertId, username, email });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ message: 'Error al registrar usuario' });
  } finally {
    if (connection) connection.release(); // Liberar conexión
  }
};


exports.loginUser = async (req, res) => {
  console.log('en loginUser ***');
  let connection;
  try {
    // Validar resultados de la validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array()[0].msg });
    }

    
    const { username, password } = req.body;
    // Conectar a la base de datos
    connection = await db.getConnection();
    const [rows] = await connection.query(
      `SELECT 
        id_user
        , CONCAT(name, \' \', last_name) AS full_name
        , id_role, is_password
        , is_active
        , password
        , username 
      FROM 
        users 
      WHERE 
      username = ?`,
      [username]
    );
  
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Password incorrect' });
    if (user.is_active === 0) return res.status(401).json({ message: 'User inactive' });

    // Crear y enviar token JWT
    const token = jwt.sign(
      { 
        id_user: user.id_user
        ,id_role: user.id_role 
        ,username: user.username 
        ,full_name: user.full_name 
        ,is_password: user.is_password 
      }, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: one_hour_interval 
      }
    );

    res.cookie(`token`, token, {
      httpOnly: true, // Solo accesible a través de HTTP
      secure: true, // Solo en HTTPS en producción
      maxAge: one_hour_interval, // 1 hora en milisegundos
      sameSite: 'Lax', // Para proteger contra CSRF
    })

    const currentTime = moment(); // Fecha y hora actual
    const expirationTime = currentTime.clone().add(one_hour_interval, 'milliseconds'); // Sumar expiresIntervalMs

    res.status(200).json(
      { 
        success: true,
        message: 'Login successful',
        result: {
          'userName':user.full_name
          ,'expirationTime': expirationTime.format("YYYY-MM-DD HH:mm:ss")
        },
      }
    );
  } catch (err) {
    console.error('Login errors:', err);
    res.status(500).json(
      { 
        success: false,
        message: 'Login errors' 
      }
    );
  } finally {
    if (connection) connection.release(); // Liberar conexión
  }
};


exports.logoutUser = (req, res) => {
  console.log('en logoutUser ***');  
  const token = req.cookies.token; 
  
  if (isTokenRevoked(token)) { 
    return res.status(401).json({ 
      success: false,
      message: "Token is revoked." 
    });
  }

  if (token) {
    // Almacena el token con la hora actual
    revokedTokens.set(token, Date.now()); 

    // Limpiar la cookie del cliente
    res.clearCookie("token", {
      httpOnly: true,
      secure: true, // Usar `true` en producción si usas HTTPS
      sameSite: "Strict"
    });

    return res.status(200).json({ 
      success: true,
      message: "Session completed successfully." 
    });
  } else {
    return res.status(400).json({ 
      success: false,
      message: "Token not found in cookie." 
    });
  }
};

exports.renewToken = (req, res) => {
  const token = req.cookies.token; // Obtener el token de la cookie HttpOnly

  if (!token) {
    return res.status(403).json({ message: "Token not provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token." });
    }

    // Crear un nuevo token
    const newToken = jwt.sign(
      { 
        id_user: user.id_user
        ,id_role: user.id_role 
        ,username: user.username 
        ,full_name: user.full_name 
        ,is_password: user.is_password 
      }, 
      process.env.JWT_SECRET, 
      { 
          expiresIn: one_hour_interval 
      }
    );

    // Enviar el nuevo token en la cookie HttpOnly
    res.cookie('token', newToken, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'Lax',
      maxAge: one_hour_interval // 1 hora de expiración
    });

    const currentTime = moment(); // Fecha y hora actual
    const expirationTime = currentTime.clone().add(one_hour_interval, 'milliseconds'); // Sumar expiresIntervalMs

    res.status(200).json(
    { 
      success: true,
      message: 'Token renewed successfully',
      result: {
        'userName':user.full_name
        ,'expirationTime': expirationTime.format("YYYY-MM-DD HH:mm:ss")
      }
    });
  });
};
