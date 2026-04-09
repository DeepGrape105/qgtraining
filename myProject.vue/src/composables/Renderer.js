import { useCanvasStore } from '../store/canvasStore';

// 负责根据元素类型调用不同的绘制方法
export default class Renderer {
  static draw(ctx, element) {
    // 访问 store 获取当前选中了谁
    const store = useCanvasStore(); 

    if (!ctx || !element) return;// 基础检查，确保有绘图上下文和元素数据

    ctx.save(); // 保存当前状态，设置全局透明度，以便后续恢复
    ctx.globalAlpha = element.opacity ?? 1;

    //分别处理不同类型的元素，调用对应的绘制方法
    try {
      switch (element.type) {
        case 'rect':
          this.drawRect(ctx, element);
          break;
        case 'circle':
          this.drawCircle(ctx, element);
          break;
        case 'triangle':
          this.drawTriangle(ctx, element);
          break;
        default:
          console.warn(`[Renderer] 未知类型: ${element.type}`);
      }

      // 如果当前元素被选中，绘制高亮边框
      if (store.selection === element.id) {
        this.drawHighlight(ctx, element);
      }
    } catch (error) {
      console.error(`[Renderer] 渲染错误:`, error);
    } finally {
      ctx.restore();
    }
  }

  // --- 具体的绘制逻辑 ---

  // 绘制矩形
  static drawRect(ctx, el) {
    ctx.beginPath();
    ctx.rect(el.x, el.y, el.width, el.height);
    this.applyStyle(ctx, el);
  }

  // 绘制圆形
  static drawCircle(ctx, el) {
    ctx.beginPath();
    // arc 参数: (圆心x, 圆心y, 半径, 起始弧度, 结束弧度)
    ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
    this.applyStyle(ctx, el);
  }

  // 绘制三角形
  static drawTriangle(ctx, el) {
    if (!el.points || el.points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    ctx.lineTo(el.points[1].x, el.points[1].y);
    ctx.lineTo(el.points[2].x, el.points[2].y);
    ctx.closePath(); // 闭合路径形成三角形
    this.applyStyle(ctx, el);
  }

  /**
   * 公共样式应用方法，减少重复代码
   */
  static applyStyle(ctx, el) {
    // 根据元素属性设置填充和边框样式，先填充后描边，确保边框在上层显示
    if (el.fill) {
      ctx.fillStyle = el.fill;
      ctx.fill();
    }

    // 设置边框
    if (el.stroke && el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.stroke();
    }
  }

  /**
   * 绘制高亮辅助框
   */
  static drawHighlight(ctx, el) {
    ctx.beginPath();// 开始新路径，设置样式
    ctx.strokeStyle = '#1890ff'; // 经典的选中蓝
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // 虚线效果

    // 根据元素类型绘制对应的高亮边框，注意要稍微扩大范围以便更明显
    if (el.type === 'rect') {
      ctx.strokeRect(el.x - 5, el.y - 5, el.width + 10, el.height + 10);
    } else if (el.type === 'circle') {
      ctx.arc(el.x, el.y, el.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (el.type === 'triangle') {
      el.points.forEach((p, i) => {
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    }

    ctx.setLineDash([]); // 恢复实线
  }
}