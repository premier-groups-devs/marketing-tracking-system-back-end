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
    const { username, email, password, full_name } = req.body;

    // Dividir full_name en name y last_name
    const [name, last_name] = full_name.split(' ');

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
      'INSERT INTO user (username, email, password, name, last_name) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, name, last_name]
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
    const [rows] = await connection.query('CALL GetUserByUsername(?)', [username]);
  
    if (rows[0].length === 0) return res.status(404).json({ message: 'User not found' });
    const user = rows[0][0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Password incorrect' });
    if (user.is_active === 0) return res.status(401).json({ message: 'User inactive' });

    // Crear y enviar token JWT
    const token = jwt.sign(
      { 
        id_user: user.id_user,
        id_role: user.id_role,
        username: user.username,
        full_name: user.full_name,
        is_password: user.is_password 
      }, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: one_hour_interval 
      }
    );

    res.cookie('token', token, {
      httpOnly: true, // Solo accesible a través de HTTP
      secure: true, // Solo en HTTPS en producción
      maxAge: one_hour_interval, // 1 hora en milisegundos
      sameSite: 'None', // Para proteger contra CSRF
    });

    const currentTime = moment(); // Fecha y hora actual
    const expirationTime = currentTime.clone().add(one_hour_interval, 'milliseconds'); // Sumar expiresIntervalMs

    res.status(200).json(
      { 
        success: true,
        message: 'Login successful',
        result: {
          userName: user.full_name,
          expirationTime: expirationTime.format("YYYY-MM-DD HH:mm:ss")
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
      sameSite: "None"
    });

    return res.status(200).json({ 
      success: true,
      message: "Session completed successfully." 
    });
  } else {
    //TODO review tokens
    // return res.status(400).json({ 
    //   success: false,
    //   message: "Token not found in cookie." 
    // });
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
      secure: true, 
      sameSite: 'None',
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

exports.userList = async (req, res) => {
  console.log('en userList ***');
  const token = req.cookies.token; 

  if (isTokenRevoked(token)) { 
    return res.status(401).json({ 
      success: false,
      message: "Token is revoked." 
    });
  }

  //TODO review tokens
  // if (!token) {
  //   return res.status(400).json({ 
  //     success: false,
  //     message: "Token not found in cookie." 
  //   });
  // }

  let connection;
  try {
    connection = await db.getConnection();
    const [users] = await connection.query('CALL GetUserList()');
    res.status(200).json({
      success: true,
      message: 'User list successful',
      result: {
      arrayUser: users[0],
      arrayCompany: users[1]
      }
    });
  } catch (err) {
    console.error('Error en la consulta:', err);
    res.status(500).json({ success: false, message: 'User list errors', error: err.message });
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

exports.toggleUserStatus = async (req, res) => {
  console.log('en toggleUserStatus ***');
  const token = req.cookies.token; 

  if (isTokenRevoked(token)) { 
    return res.status(401).json({ 
      success: false,
      message: "Token is revoked." 
    });
  }

  const { id_user } = req.params;
  const { is_active } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array()[0].msg });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.query('CALL ToggleUserStatus(?, ?)', [id_user, is_active]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User status updated successfully'
    });
  } catch (err) {
    console.error('Error al actualizar el estado del usuario:', err);
    res.status(500).json({ message: 'Error al actualizar el estado del usuario' });
  } finally {
    if (connection) connection.release(); // Liberar conexión
  }
};