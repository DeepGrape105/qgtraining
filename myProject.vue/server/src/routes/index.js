// 本模块负责路由分发
const express = require('express');
const router = express.Router();
const canvasController = require('../controllers/canvasController');
const { validateToken } = require('../middleware/auth');

// 路由分发
router.put('/canvas/:id', validateToken, canvasController.saveCanvas);
router.get('/canvas/:id', validateToken, canvasController.getLatestCanvas);
router.get('/canvas/:id/history', validateToken, canvasController.getHistory);

module.exports = router;