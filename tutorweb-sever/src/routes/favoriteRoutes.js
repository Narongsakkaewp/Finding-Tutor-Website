// routes/favoriteRoutes.js
const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController'); // เรียกไฟล์ Controller ที่เพิ่งสร้าง

// กำหนด URL path
router.post('/toggle', favoriteController.toggleLike);           // POST /api/favorites/toggle
router.get('/user/:user_id', favoriteController.getMyFavorites); // GET /api/favorites/user/:id
router.get('/feed-recommend/:studentId', favoriteController.getRecommendedFeed); // GET /api/favorites/feed-recommend/:id

module.exports = router;