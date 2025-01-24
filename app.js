// app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routes = require('./routes');
const cookieParser = require('cookie-parser');
const { setupWebSocket } = require('./services/websocket');
const { clearRevokedTokens } = require('./middlewares/authMiddleware');
const http = require('http'); // Importa http para crear el servidor
const app = express();

// Usa cookie-parser para manejar cookies
app.use(cookieParser());

// Configura el origen permitido para CORS
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:8080'; // Usa variable de entorno o localhost

// Middlewares para seguridad y manejo de CORS
app.use(helmet());
app.use(cors({
  origin: origin, // Permitir origen configurado
  credentials: true, // Permite el envío de cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeceras permitidas
}));

// Middleware para procesar JSON
app.use(express.json());

// Ruta de prueba de la API
app.get('/api/health', (req, res) => {
  res.json({ status: 'API working correctly' });
});

// Rutas
app.use('/api', routes); // Prefijo de ruta común

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Crear servidor HTTP y pasar a WebSocket
const server = http.createServer(app);
//console.log('ver: '+JSON.stringify(server))
setupWebSocket(server); // Usa la función setupWebSocket para inicializar wss


// Puerto de escucha
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Limpiar los tokens revocados cada hora
/*setInterval(() => {
  clearRevokedTokens();
}, process.env.MAXAGE);//3600000); // 3600000 ms = 1 hora*/