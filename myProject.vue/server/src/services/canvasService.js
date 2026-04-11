//保证更新主表和创建快照同时成功或同时失败
const pool = require('../config/db');

class CanvasService {
  /**
   * 处理“保存”动作引发的连锁反应
   * 7 步事务逻辑，1. 获取连接 2. 开启事务 3. 序列化 4. 更新主表 5. 创建快照 6. 提交事务 7. 释放连接
   */
  async saveAndSnapshot(canvasId, elements, config) {
    // 1. 从连接池获取连接
    const conn = await pool.getConnection();

    try {
      // 2. 开启事务
      await conn.beginTransaction();

      // 3. 序列化
      const contentStr = JSON.stringify(elements);
      const configStr = JSON.stringify(config);

      // 4. 更新主表，使用预编译，防sql注入
      await conn.query(
        'UPDATE canvases SET content = ?, config = ? WHERE id = ?',
        [contentStr, configStr, canvasId]
      );

      // 5. 创建快照 (记录此刻的全量 JSON)
      const [snapshotResult] = await conn.query(
        'INSERT INTO snapshots (canvas_id, content) VALUES (?, ?)',
        [canvasId, contentStr]
      );

      // 6. 提交事务
      await conn.commit();

      return snapshotResult.insertId; // 返回生成的快照 ID

    } catch (error) {
      // 捕获到任何错误则回滚
      await conn.rollback();
      throw error; // 将错误向上抛出给 Controller 处理
    } finally {
      // 7. 释放连接 (极其重要，防止连接池耗尽)
      conn.release();
    }
  }
}

module.exports = new CanvasService();