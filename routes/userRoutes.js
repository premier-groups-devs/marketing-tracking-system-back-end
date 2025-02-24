const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Importar el middleware

const router = express.Router();

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
router.post('/renew-token', authenticateToken, userController.renewToken);
router.get('/list', authenticateToken, userController.userList);
router.post(
  '/register',
  authenticateToken,
  [
    body('full_name')
      .notEmpty().withMessage('Full name cannot be empty.')
      .isString().withMessage('Full name must be a string.'),
    body('email')
      .notEmpty().withMessage('Email cannot be empty.')
      .isEmail().withMessage('Must be a valid email.'),
    body('username')
      .notEmpty().withMessage('Username cannot be empty.')
      .isString().withMessage('Username must be a string.'),
    body('id_company')
      .notEmpty().withMessage('Company ID cannot be empty.')
      .isNumeric().withMessage('Company ID must be a number.'),
    body('password')
      .optional()
      .isString().withMessage('Password must be a string.'),
    body('id_user')
      .optional()
      .isNumeric().withMessage('User ID must be a number.'),
  ],
  userController.userRegister
);

module.exports = router;
