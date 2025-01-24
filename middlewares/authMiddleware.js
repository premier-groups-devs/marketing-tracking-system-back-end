const jwt = require('jsonwebtoken');
const revokedTokens = new Map();

exports.authenticateToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(403).json({ message: "Token not provided." });
  }

  // Verificar si el token ha sido revocado
  if (revokedTokens.has(token)) {
    return res.status(401).json({ message: "Invalid token or expired session." });
  }

  // Verificar la validez del token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token." });
    }
    req.user = user;
    next();
  });
};

// Función para revocar un token
exports.revokeToken = (token) => {
  const now = Date.now();
  revokedTokens.set(token, now);
};

// Comprobar si un token ha sido revocado
exports.isTokenRevoked = (token) => {
  return revokedTokens.has(token);
};

// Limpiar los tokens revocados después de una hora
exports.clearRevokedTokens = () => {
  const now = Date.now();
  for (const [token, revocationTime] of revokedTokens.entries()) {
    if (now - revocationTime > 60 * 60 * 1000) {
      revokedTokens.delete(token);
    }
  }
};

exports.revokedTokens = revokedTokens;
