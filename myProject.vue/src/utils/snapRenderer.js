// src/utils/snapRenderer.js

/**
 * 绘制对齐辅助线
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {Array} snapLines - 对齐线数组
 * @param {Object} viewport - 视口信息 { offsetX, offsetY, scale }
 * @param {number} canvasWidth - 画布宽度
 * @param {number} canvasHeight - 画布高度
 */
export function drawSnapLines(ctx, snapLines, viewport, canvasWidth, canvasHeight) {
  if (!snapLines || snapLines.length === 0) return;

  const { offsetX, offsetY, scale } = viewport;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // 计算世界坐标系中的可见区域
  const worldLeft = -offsetX / scale;
  const worldRight = worldLeft + canvasWidth / scale;
  const worldTop = -offsetY / scale;
  const worldBottom = worldTop + canvasHeight / scale;

  snapLines.forEach(line => {
    ctx.beginPath();
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([4 / scale, 4 / scale]);

    if (line.type === 'vertical') {
      const x = line.position;
      if (x >= worldLeft && x <= worldRight) {
        ctx.moveTo(x, worldTop);
        ctx.lineTo(x, worldBottom);
      }
    } else {
      const y = line.position;
      if (y >= worldTop && y <= worldBottom) {
        ctx.moveTo(worldLeft, y);
        ctx.lineTo(worldRight, y);
      }
    }
    ctx.stroke();
  });

  ctx.setLineDash([]);
  ctx.restore();
}