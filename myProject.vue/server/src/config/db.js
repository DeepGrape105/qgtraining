//引入 MySQL 驱动
const mysql = require('mysql2/promise');

// 创建支持 async/await 的连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin123',
  database: 'qg_canvas',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;