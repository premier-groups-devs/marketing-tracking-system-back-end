// app.js
const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const routes = require('./routes');
const cookieParser = require('cookie-parser');
const { setupWebSocket } = require('./services/websocket');
const { clearRevokedTokens } = require('./middlewares/authMiddleware');
const http = require('http'); // Importa http para crear el servidor
const app = express();

dotenv.config(); // Ensure environment variables are loaded

// Usa cookie-parser para manejar cookies
app.use(cookieParser());

// Configura el origen permitido para CORS
// CLIENT_ORIGINS="http://localhost:4200,https://marketing-tracking-system-f-0lpxu.kinsta.page,https://victorious-island-037d99b10.2.azurestaticapps.net"
const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:4200")
  .split(',')
  .map(o => o.trim());

// Middlewares para seguridad y manejo de CORS
const corsOptions = {
  origin: (incomingOrigin, callback) => {
    if (!incomingOrigin || allowedOrigins.includes(incomingOrigin)) {
      console.log(`CORS permitido para origen: ${incomingOrigin}`);
      return callback(null, true);
    }
    callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};

// 1) Handle preflight across the board
app.options('*', cors(corsOptions));

// 2) Then apply CORS to all actual routes
app.use(cors(corsOptions));

app.use(helmet());

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
console.log('WebSocket setup complete'); // Add a log to confirm WebSocket setup


// Puerto de escucha
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Limpiar los tokens revocados cada hora
/*setInterval(() => {
  clearRevokedTokens();
}, process.env.MAXAGE || 3600000); // 3600000 ms = 1 hora, fallback to 1 hour if MAXAGE is not set*/