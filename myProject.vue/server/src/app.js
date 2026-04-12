require('dotenv').config()
const express = require('express');
const cors = require('cors');
const routes = require('../src/routes/index.js');

const app = express();

// 开启 cors 跨域支持
app.use(cors());

// 设置 limit 为 50mb，承载包含大量元素的 JSON 字符串
app.use(express.json({ limit: '50mb' }));

// 挂载总路由
app.use('/api', routes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`[Server] 后端服务已启动: http://localhost:${PORT}`);
  console.log(`name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
});