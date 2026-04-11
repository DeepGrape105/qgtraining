const pool = require('../config/db');

class SnapshotRepo {
  /**
   * 返回该画布的所有版本简报（ID、时间）
   */
  async findSnapshotsByCanvasId(canvasId) {
    const [rows] = await pool.query(
      'SELECT id, created_at FROM snapshots WHERE canvas_id = ? ORDER BY created_at DESC',
      [canvasId]
    );
    return rows;
  }
}

module.exports = new SnapshotRepo();