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

module.exports = router;