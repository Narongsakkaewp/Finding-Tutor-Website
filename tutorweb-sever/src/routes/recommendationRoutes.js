// src/routes/recommendationRoutes.js
const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

router.get('/', recommendationController.getRecommendations);

module.exports = router;