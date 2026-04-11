const pool = require('../config/db');

class CanvasRepo {
  /**
   * 获取当前画布最新状态
   */
  async findCanvasById(id) {
    // 使用 query 查询，返回数组的第一个元素是结果集
    const [rows] = await pool.query('SELECT * FROM canvases WHERE id = ?', [id]);
    return rows[0] || null;
  }
}

module.exports = new CanvasRepo();