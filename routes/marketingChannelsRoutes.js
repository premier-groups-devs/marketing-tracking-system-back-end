const express = require('express');
const { body, param } = require('express-validator');
const marketingChannelsController = require('../controllers/marketingChannelsController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Importar el middleware
const router = express.Router();

router.get('/list', authenticateToken, marketingChannelsController.marketingChannelsList);
router.post(
  '/register',
  authenticateToken,
  [
    body('source_name')
      .notEmpty().withMessage('Source name cannot be empty.')
      .isString().withMessage('Source name must be a string.'),
    body('cost')
      .notEmpty().withMessage('Cost cannot be empty.')
      .isNumeric().withMessage('Cost must be a number.'),
    body('insert')
      .notEmpty().withMessage('Insert cannot be empty.')
      .isNumeric().withMessage('Insert must be a number.'),
    body('date_create')
      .notEmpty().withMessage('Date create cannot be empty.')
      .isDate().withMessage('Date create must be a valid date.'),
    body('id_city')
      .notEmpty().withMessage('City ID cannot be empty.')
      .isNumeric().withMessage('City ID must be a number.'),
  ],
  marketingChannelsController.MarketingChannelsRegister
);
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
