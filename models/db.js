const mysql = require('mysql2/promise');
const dotenv = require('dotenv'); 
const fs = require('fs');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 30000, 
  ssl: {
    ca: fs.readFileSync(process.env.DB_CA_CERT), // Asegúrate de que este archivo exista y sea correcto
    rejectUnauthorized: true, // Cambia a true en producción
  },
});

// Validar conexión
pool.getConnection()
  .then(connection => {
    console.log('Connection established successfully');
    connection.release(); // Liberar conexión si se obtiene correctamente
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });

module.exports = pool;
