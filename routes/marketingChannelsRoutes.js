const express = require('express');
const { body, param } = require('express-validator');
const marketingChannelsController = require('../controllers/marketingChannelsController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Importar el middleware
const router = express.Router();

router.get('/list', authenticateToken, marketingChannelsController.marketingChannelsList);
/*router.post(
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
);*/
router.put(
  '/toggle-status/:id_marketing_channel',
  authenticateToken,
  [
    param('id_marketing_channel')
      .notEmpty().withMessage('User ID cannot be empty.')
      .isNumeric().withMessage('User ID must be a number.'),
    body('is_active')
      .notEmpty().withMessage('is_active cannot be empty.')
      .isNumeric().withMessage('is_active must be a number.'),
  ],
  marketingChannelsController.toggleMarketingChannelsStatus
);

module.exports = router;
