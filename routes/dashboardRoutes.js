const express = require('express');
const { body } = require('express-validator');
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Importar el middleware

const router = express.Router();

/*
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('El email no puede estar vacío.'),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
  ],
  dashboardController.registerUser
);

// Ruta para iniciar sesión (sin token)
router.post(
  '/login',
  [
    body('username')
      .isLength({ min: 6 }).withMessage('The user must have a minimum of 6 digits.')
      .notEmpty().withMessage('User cannot be empty.'),
    body('password')
      .exists().withMessage('Password is required.')
      .notEmpty().withMessage('Password cannot be empty.')
      .isLength({ min: 6 }).withMessage('The password must have a minimum of 6 digits.'),
  ],
  dashboardController.loginUser
);
*/

// Ruta protegida para cerrar sesión (requiere token)
router.get('/dashboard', authenticateToken, dashboardController.dashboard);

module.exports = router;
