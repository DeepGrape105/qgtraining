// 负责根据元素类型调用不同的绘制方法
export default class Renderer {
  static draw(ctx, element) {
    if (!ctx || !element) return;// 基础检查，确保有绘图上下文和元素数据
    // 保存当前状态，设置全局透明度，以便后续恢复
    ctx.save();
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
}