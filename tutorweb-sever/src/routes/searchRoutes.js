// src/routes/searchRoutes.js
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// GET /api/search?q=...
router.get('/', searchController.smartSearch);

// GET /api/search/history?user_id=...
router.get('/history', searchController.getMySearchHistory);

// DELETE /api/search/history?user_id=...&keyword=...
router.delete('/history', searchController.deleteSearchHistory);

// GET /api/search/popular (High Priority)
router.get('/popular', searchController.getPopularSubjects);

module.exports = router;