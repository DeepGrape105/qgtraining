// 本模块负责路由分发
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { validateToken } = require('../middleware/auth');
const canvasController = require('../controllers/canvasController');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/upload', validateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('无文件');

    // 将内存中的 Buffer 转为 base64 传给 Cloudinary
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: 'qg_canvas', // Cloudinary 上的文件夹名
    });

    // 返回 Cloudinary 的绝对安全链接
    res.json({
      success: true,
      data: { url: result.secure_url }
    });
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    res.status(500).json({ success: false, message: '上传至云端失败' });
  }
});

// 路由分发
router.put('/canvas/:id', validateToken, canvasController.saveCanvas);
router.get('/canvas/:id', validateToken, canvasController.getLatestCanvas);
router.get('/canvas/:id/history', validateToken, canvasController.getHistory);

module.exports = router;