// src/composables/Renderer.js
import { useCanvasStore } from '../store/canvasStore';
import { useText } from './useText'

export default class Renderer {
  static imageCache = new Map();

  static draw(ctx, element) {
    const store = useCanvasStore();
    if (!ctx || !element || element.isVisible === false) return;

    ctx.save();
    ctx.globalAlpha = (element.opacity ?? 1) * (element.isLocked ? 0.8 : 1);

    // 绘制图形主体
    switch (element.type) {
      case 'rect': this.drawRect(ctx, element); break;
      case 'circle': this.drawCircle(ctx, element); break;
      case 'triangle': this.drawTriangle(ctx, element); break;
      case 'text': this.drawText(ctx, element); break;
      case 'image': this.drawImageElement(ctx, element); break;
    }

    // 如果被选中，绘制统一的矩形选中框
    if (store.selectedIds.includes(element.id)) {
      this.drawHighlight(ctx, element, store.viewport.scale)
    }

    ctx.restore();
  }

  /**
   * 统一绘制矩形选中框 (Goodnotes 风格)
   * 逻辑：无论什么形状，先计算出左上角(minX, minY)和宽高(w, h)
   */
  static drawHighlight(ctx, el, scale) {
    let minX, minY, w, h;

    if (el.type === 'triangle') {
      // 三角形逻辑：遍历 points 获取最值
      const xs = el.points.map(p => p.x);
      const ys = el.points.map(p => p.y);
      minX = Math.min(...xs);
      minY = Math.min(...ys);
      w = Math.max(...xs) - minX;
      h = Math.max(...ys) - minY;
    } else if (el.type === 'circle') {
      // 圆形逻辑：从中心点偏移到左上角
      minX = el.x - el.radius;
      minY = el.y - el.radius;
      w = el.radius * 2;
      h = el.radius * 2;
    } else if (el.type === 'text') {
      // 文本逻辑：直接使用宽高度（注意：需要 drawText 时通过 measureText 更新宽度）
      minX = el.x;
      minY = el.y;
      w = el.width || 100;
      h = el.height || 20;
    } else {
      // 矩形/图片逻辑
      minX = el.x;
      minY = el.y;
      w = el.width;
      h = el.height;
    }

    const padding = 6 / scale; // 选中框向外扩充的距离

    ctx.save();
    // 1. 绘制虚线矩形框
    ctx.strokeStyle = '#1890ff';
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);
    ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2);

    // 2. 绘制四个角的实心手柄 (Goodnotes 风格)
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1890ff';
    const handleSize = 8 / scale;

    const corners = [
      { x: minX - padding, y: minY - padding }, // 左上
      { x: minX + w + padding, y: minY - padding }, // 右上
      { x: minX - padding, y: minY + h + padding }, // 左下
      { x: minX + w + padding, y: minY + h + padding } // 右下
    ];

    corners.forEach(corner => {
      ctx.beginPath();
      // 绘制带边框的小圆点
      ctx.arc(corner.x, corner.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }

  // --- 以下是基础图形绘制方法 ---

  static drawRect(ctx, el) {
    // 先画背景色
    if (el.backgroundColor) {
      ctx.fillStyle = el.backgroundColor
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }
    // 再画填充色
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }
    // 最后画边框
    if (el.stroke && el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.strokeRect(el.x, el.y, el.width, el.height)
    }
  }

  static drawCircle(ctx, el) {
    ctx.beginPath();
    ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
    ctx.fillStyle = el.fill;
    ctx.fill();
  }

  static drawTriangle(ctx, el) {
    if (!el.points || el.points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    ctx.lineTo(el.points[1].x, el.points[1].y);
    ctx.lineTo(el.points[2].x, el.points[2].y);
    ctx.closePath();
    ctx.fillStyle = el.fill;
    ctx.fill();
  }

  static drawText(ctx, el) {
    const {editingId} = useText()
    // 如果正在编辑这个文本，不绘制（避免和输入框重叠）
    if (editingId.value === el.id) {
      return
    }

    ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize || 20}px Arial`
    ctx.fillStyle = el.fill || '#000000'
    ctx.textBaseline = 'top'
    ctx.fillText(el.text || '', el.x, el.y)

    const metrics = ctx.measureText(el.text || '')
    el.width = metrics.width
    el.height = el.fontSize || 20
  }

  static drawImageElement(ctx, el) {
    if (!el.url) return;
    let img = this.imageCache.get(el.url);
    if (!img) {
      img = new Image();
      img.src = el.url;
      img.onload = () => this.imageCache.set(el.url, img);
    }
    if (img.complete) {
      ctx.drawImage(img, el.x, el.y, el.width, el.height);
    } else {
      // 占位
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(el.x, el.y, el.width, el.height);
    }
  }
}