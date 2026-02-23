// routes/favoriteRoutes.js
const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController'); // เรียกไฟล์ Controller ที่เพิ่งสร้าง

// กำหนด URL path
router.post('/toggle', favoriteController.toggleLike);           // POST /api/favorites/toggle
router.get('/user/:user_id', favoriteController.getMyFavorites); // GET /api/favorites/user/:id
router.get('/feed-recommend/:studentId', favoriteController.getRecommendedFeed); // GET /api/favorites/feed-recommend/:id

// ✅ New Routes for Tutor Favorites
router.post('/tutor/toggle', favoriteController.toggleTutorLike);           // POST /api/favorites/tutor/toggle
router.get('/tutor/user/:userId', favoriteController.getMyTutorFavorites);  // GET /api/favorites/tutor/user/:id

module.exports = router;