const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const one_hour_interval = parseInt(process.env.ONE_HOUR_INTERVAL); // Convertir a número

// Ruta para renovar el token
router.post('/refresh-token', (req, res) => {
    const token = req.cookies.token; // Suponiendo que el token se almacena en una cookie

    if (!token) {
        return res.status(403).json({ success: false, message: 'No token provided.' });
    }

    // Verificar el token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Failed to authenticate token.' });
        }

        // Generar un nuevo token
        const newToken = jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: one_hour_interval });

        // Enviar el nuevo token al cliente
        res.cookie('token', newToken, { httpOnly: true });
        res.json({ success: true, token: newToken });
    });
});

module.exports = router;