//控制器层，负责接收前端请求、调用业务逻辑、返回响应
const canvasService = require('../services/canvasService');
const canvasRepo = require('../repositories/canvasRepo');
const snapshotRepo = require('../repositories/snapshotRepo');

class CanvasController {
  /**
   * 响应 PUT /api/canvas/:id
   */
  async saveCanvas(req, res) {
    try {
      const { id } = req.params;
      const { elements, config } = req.body;

      // 调用 Service 层的事务逻辑
      const snapshotId = await canvasService.saveAndSnapshot(id, elements, config);

      // 严格按照文档 API Schema 规定的标准 JSON 格式返回
      res.json({
        success: true,
        data: {
          canvasId: id,
          snapshotId: snapshotId
        },
        message: '保存成功'
      });
    } catch (error) {
      console.error('[CanvasController] 保存失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
  
  /**
   * 获取最新画布数据
   */
  async getLatestCanvas(req, res) {
    try {
      const { id } = req.params;
      const canvas = await canvasRepo.findCanvasById(id);

      if (!canvas) {
        return res.status(404).json({ success: false, message: '找不到该画布' });
      }

      res.json({
        success: true,
        data: {
          id: canvas.id,
          config: JSON.parse(canvas.config),
          elements: JSON.parse(canvas.content)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: '读取失败' });
    }
  }

  /**
   * 获取历史版本列表
   */
  async getHistory(req, res) {
    try {
      const { id } = req.params;
      const history = await snapshotRepo.findSnapshotsByCanvasId(id);
      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, message: '获取历史记录失败' });
    }
  }
}

module.exports = new CanvasController();