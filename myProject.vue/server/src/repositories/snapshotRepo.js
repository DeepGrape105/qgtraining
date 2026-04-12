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

  /**
   * 根据快照ID获取具体的画布内容
   */
  async findSnapshotById(snapshotId) {
    const [rows] = await pool.query(
      'SELECT content FROM snapshots WHERE id = ?',
      [snapshotId]
    );
    return rows[0] || null;
  }
}

module.exports = new SnapshotRepo();