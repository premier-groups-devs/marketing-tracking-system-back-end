const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Importar el middleware

const router = express.Router();

// Ruta para registrar usuario (sin token)
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('El email no puede estar vacío.'),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
  ],
  userController.registerUser
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
  userController.loginUser
);

// Ruta protegida para cerrar sesión (requiere token)
router.post('/logout', authenticateToken, userController.logoutUser);
// Ruta protegida para cerrar sesión (requiere token)
router.post('/renew-token', authenticateToken, userController.renewToken);

module.exports = router;
