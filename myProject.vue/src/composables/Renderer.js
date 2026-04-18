//渲染逻辑层，负责将各种图形元素绘制到  Canvas 上
import { useCanvasStore } from '../store/canvasStore';
import { useText } from './useText'
import { parseRichText } from "../utils/textParser";
import { getElementBounds, rotatePoint } from '../utils/geometry'

/**
 * Renderer 类：负责将各种图形元素绘制到 HTML5 Canvas 上
 * 采用静态方法设计，作为无状态的渲染工具集使用
 */
export default class Renderer {
  // 图片缓存池：避免重复创建 Image 对象导致的闪烁及性能开销
  static imageCache = new Map();

  /**
   * 渲染入口方法
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {Object} element - 待渲染的元素数据对象
   * @param {Object} options - 渲染配置（如是否跳过高亮）
   */
  static draw(ctx, element, options = {}) {
    const store = useCanvasStore()
    // 边界检查：若上下文丢失、元素为空或被隐藏，则跳过渲染
    if (!ctx || !element || element.isVisible === false) return

    ctx.save() // 开启独立状态栈，防止透明度、变换等属性污染全局

    // 应用透明度：结合锁定状态的视觉反馈
    ctx.globalAlpha = (element.opacity ?? 1) * (element.isLocked ? 0.8 : 1)

    // 多态分发：根据元素类型调用对应的私有绘制方法
    switch (element.type) {
      case 'rect': this.drawRect(ctx, element); break
      case 'circle': this.drawCircle(ctx, element); break
      case 'triangle': this.drawTriangle(ctx, element); break
      case 'text': this.drawText(ctx, element); break
      case 'image': this.drawImageElement(ctx, element); break
    }

    // 选中反馈绘制：在元素本体之上覆盖辅助线和操作手柄
    if (!options.skipHighlight && store.selectedIds.includes(element.id)) {
      this.drawHighlight(ctx, element, store.viewport.scale)
    }

    ctx.restore() // 恢复渲染上下文，确保下一元素渲染环境纯净
  }

  /**
   * 绘制选中状态的高亮边框及控制点（四角缩放手柄 + 顶部旋转手柄）
   */
  static drawHighlight(ctx, el, scale) {
    const bounds = getElementBounds(el)
    const { minX, minY, width: w, height: h, centerX, centerY } = bounds
    const center = { x: centerX, y: centerY }

    // 屏幕适配：根据当前视口缩放比例调整手柄视觉大小
    const padding = 8 / scale
    const handleSize = 10 / scale

    // 1. 计算坐标空间：定义四角手柄相对于元素中心未旋转时的偏移
    const cornerOffsets = [
      { x: -w / 2 - padding, y: -h / 2 - padding },
      { x: w / 2 + padding, y: -h / 2 - padding },
      { x: -w / 2 - padding, y: h / 2 + padding },
      { x: w / 2 + padding, y: h / 2 + padding }
    ]

    // 2. 变换计算：将偏移点应用旋转算法，得到最终在 Canvas 上的物理坐标
    const corners = cornerOffsets.map(offset => {
      const point = { x: center.x + offset.x, y: center.y + offset.y }
      return rotatePoint(point, center, el.rotation)
    })

    const topMidPoint = { x: center.x, y: center.y - h / 2 - padding }
    const topMid = rotatePoint(topMidPoint, center, el.rotation)

    const rotatePointOffset = { x: center.x, y: center.y - h / 2 - padding - 28 / scale }
    const rotateHandle = rotatePoint(rotatePointOffset, center, el.rotation)

    // 绘制旋转框：此处需进入旋转坐标系绘制
    ctx.save()
    if (el.rotation) {
      ctx.translate(center.x, center.y)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-center.x, -center.y)
    }
    ctx.strokeStyle = '#1890ff'
    ctx.lineWidth = 2 / scale
    ctx.setLineDash([])
    ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2)
    ctx.restore()

    // 绘制旋转手柄的连接直线
    ctx.beginPath()
    ctx.strokeStyle = '#1890ff'
    ctx.lineWidth = 1.5 / scale
    ctx.setLineDash([])
    ctx.moveTo(topMid.x, topMid.y)
    ctx.lineTo(rotateHandle.x, rotateHandle.y)
    ctx.stroke()

    // 绘制四角缩放手柄（圆点）
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#1890ff'
    corners.forEach(corner => {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, handleSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    })

    // 绘制旋转手柄（带投影的特殊设计）
    ctx.beginPath()
    ctx.fillStyle = '#4CAF50'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    ctx.shadowBlur = 4 / scale
    ctx.arc(rotateHandle.x, rotateHandle.y, handleSize / 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'

    // 绘制手柄上的反光小白点
    ctx.beginPath()
    ctx.fillStyle = '#ffffff'
    ctx.arc(rotateHandle.x - 2 / scale, rotateHandle.y - 2 / scale, handleSize / 6, 0, Math.PI * 2)
    ctx.fill()
  }

  /**
   * 绘制矩形元素
   * 逻辑区分：对于无旋转元素使用直接路径绘制（性能更优），有旋转元素应用旋转变换
   */
  static drawRect(ctx, el) {
    if (!el.rotation) {
      // 路径逻辑：填充 -> 描边
      if (el.backgroundColor) {
        ctx.fillStyle = el.backgroundColor
        ctx.fillRect(el.x, el.y, el.width, el.height)
      }
      if (el.fill) {
        ctx.fillStyle = el.fill
        ctx.fillRect(el.x, el.y, el.width, el.height)
      }
      if (el.stroke && el.strokeWidth > 0) {
        const halfStroke = el.strokeWidth / 2
        ctx.strokeStyle = el.stroke
        ctx.lineWidth = el.strokeWidth
        // 描边矩形：需考虑 lineWidth 导致的外扩量
        ctx.strokeRect(
          el.x - halfStroke,
          el.y - halfStroke,
          el.width + el.strokeWidth,
          el.height + el.strokeWidth
        )
      }
      return
    }

    // 矩阵变换逻辑
    const center = {
      x: el.x + el.width / 2,
      y: el.y + el.height / 2
    }

    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate((el.rotation * Math.PI) / 180)
    ctx.translate(-center.x, -center.y)

    if (el.backgroundColor) {
      ctx.fillStyle = el.backgroundColor
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }
    if (el.stroke && el.strokeWidth > 0) {
      const halfStroke = el.strokeWidth / 2
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.strokeRect(
        el.x - halfStroke,
        el.y - halfStroke,
        el.width + el.strokeWidth,
        el.height + el.strokeWidth
      )
    }

    ctx.restore()
  }

  /**
   * 绘制圆形元素
   */
  static drawCircle(ctx, el) {
    // 视觉修正：计算包含描边厚度后的总半径
    const radius = el.strokeWidth > 0 ? el.radius + el.strokeWidth / 2 : el.radius
    const center = { x: el.x, y: el.y }

    if (el.rotation) {
      ctx.save()
      ctx.translate(center.x, center.y)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-center.x, -center.y)
    }

    ctx.beginPath()
    ctx.arc(el.x, el.y, radius, 0, Math.PI * 2)

    if (el.backgroundColor && el.backgroundColor !== '#00000000') {
      ctx.fillStyle = el.backgroundColor
      ctx.fill()
    }
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fill()
    }
    if (el.stroke && el.strokeWidth > 0 && el.stroke !== '#00000000') {
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.stroke()
    }
    if (el.rotation) ctx.restore()
  }

  /**
   * 绘制三角形元素
   * 基于 points 数组绘制，并根据几何中心进行旋转
   */
  static drawTriangle(ctx, el) {
    if (!el.points || el.points.length < 3) return

    // 获取形心（重心）作为旋转支点
    const center = {
      x: (el.points[0].x + el.points[1].x + el.points[2].x) / 3,
      y: (el.points[0].y + el.points[1].y + el.points[2].y) / 3
    }

    if (el.rotation) {
      ctx.save()
      ctx.translate(center.x, center.y)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-center.x, -center.y)
    }

    // 边框溢出处理：计算顶点向外扩增后的坐标
    let points = el.points
    if (el.stroke && el.strokeWidth > 0 && el.stroke !== '#00000000') {
      const halfStroke = el.strokeWidth / 2
      points = el.points.map(p => {
        const dx = p.x - center.x
        const dy = p.y - center.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        return {
          x: p.x + (dx / dist) * halfStroke,
          y: p.y + (dy / dist) * halfStroke
        }
      })
    }

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    ctx.lineTo(points[2].x, points[2].y)
    ctx.closePath()

    if (el.backgroundColor && el.backgroundColor !== '#00000000') {
      ctx.fillStyle = el.backgroundColor
      ctx.fill()
    }
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fill()
    }
    if (el.stroke && el.strokeWidth > 0 && el.stroke !== '#00000000') {
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.stroke()
    }

    if (el.rotation) ctx.restore()
  }

  /**
   * 复杂渲染：文本与富文本绘制
   * 包含：动态高度计算、自动换行算法（中英文分词）、下划线/删除线渲染
   */
  static drawText(ctx, el) {
    const { editingId } = useText()
    const text = String(el.text || '');
    const padding = el.padding || 8;
    const boxWidth = el.width || 200;
    const maxWidth = boxWidth - padding * 2;
    const fontSize = el.fontSize || 20;
    const fontWeight = el.fontWeight || 'normal';
    const fontFamily = el.fontFamily || 'Arial';
    const lineHeight = fontSize * 1.4;

    // --- 第一步：布局测量（预计算动态高度） ---
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const displayText = (editingId.value === el.id && text === '') ? ' ' : text;

    // 分词并执行换行模拟
    const chars = displayText.split('');
    const tempLines = [];
    let tempLine = '';
    for (let char of chars) {
      if (char === '\n') {
        tempLines.push(tempLine);
        tempLine = '';
        continue;
      }
      const metrics = ctx.measureText(tempLine + char);
      if (metrics.width > maxWidth && tempLine.length > 0) {
        tempLines.push(tempLine);
        tempLine = char;
      } else {
        tempLine += char;
      }
    }
    tempLines.push(tempLine);

    // 回写元素高度：保证包围盒随文字内容动态拉伸
    const neededHeight = tempLines.length * lineHeight + padding * 2;
    const boxHeight = Math.max(neededHeight, fontSize + padding * 2);
    el.height = boxHeight;

    // --- 第二步：解析富文本片段 ---
    const richText = el.richText || displayText;
    const segments = parseRichText(richText, el.fill || '#000000', fontSize, fontWeight, fontFamily);

    // 计算实际需要的最大宽度，用于绘制背景框
    let maxLineWidth = 0;
    segments.forEach(seg => {
      if (seg.text === '\n') return;
      let fontStyle = '';
      if (seg.bold) fontStyle += 'bold ';
      if (seg.italic) fontStyle += 'italic ';
      ctx.font = `${fontStyle}${seg.fontSize || fontSize}px ${seg.fontFamily || fontFamily}`;

      const isChinese = /[\u4e00-\u9fa5]/.test(seg.text);
      let line = '';
      if (isChinese) {
        const chars = seg.text.split('');
        for (let char of chars) {
          const testLine = line + char;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line.length > 0) {
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
            line = char;
          } else { line = testLine; }
        }
      } else {
        const words = seg.text.split(' ');
        for (let word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line.length > 0) {
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
            line = word;
          } else { line = line ? line + ' ' + word : word; }
        }
      }
      if (line) maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    });

    const actualWidth = Math.max(boxWidth, maxLineWidth + padding * 2);
    const center = { x: el.x + actualWidth / 2, y: el.y + boxHeight / 2 }

    if (el.rotation) {
      ctx.save()
      ctx.translate(center.x, center.y)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-center.x, -center.y)
    }

    // --- 第三步：渲染背景和边框 ---
    if (el.backgroundColor && el.backgroundColor !== '#00000000') {
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(el.x, el.y, actualWidth, boxHeight);
    }

    if (el.stroke && el.strokeWidth > 0 && el.stroke !== '#00000000') {
      const halfStroke = el.strokeWidth / 2;
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.strokeRect(
        el.x - halfStroke, el.y - halfStroke,
        actualWidth + el.strokeWidth, boxHeight + el.strokeWidth
      );
    }

    // --- 第四步：执行实际绘制逻辑（编辑状态下交由 DOM 编辑器，此处不画） ---
    if (editingId.value === el.id) return;

    let currentY = el.y + padding;
    let currentX = el.x + padding;

    segments.forEach(seg => {
      if (seg.text === '\n') {
        currentY += lineHeight;
        currentX = el.x + padding;
        return;
      }

      // 设置当前片段的字体样式
      let fontStyle = '';
      if (seg.bold) fontStyle += 'bold ';
      if (seg.italic) fontStyle += 'italic ';
      ctx.font = `${fontStyle}${seg.fontSize || fontSize}px ${seg.fontFamily || fontFamily}`;
      ctx.fillStyle = seg.color;
      ctx.textBaseline = 'top';

      const isChinese = /[\u4e00-\u9fa5]/.test(seg.text);

      if (isChinese) {
        // 中文逐字符渲染：确保复杂的换行逻辑能精准执行
        const chars = seg.text.split('');
        for (let char of chars) {
          const charWidth = ctx.measureText(char).width;
          if (currentX + charWidth > el.x + padding + maxWidth) {
            currentY += lineHeight;
            currentX = el.x + padding;
          }
          if (seg.backgroundColor && seg.backgroundColor !== '#00000000') {
            ctx.fillStyle = seg.backgroundColor;
            ctx.fillRect(currentX, currentY, charWidth, fontSize);
          }
          ctx.fillStyle = seg.color;
          ctx.fillText(char, currentX, currentY);

          // 装饰线绘制（支持加粗下划线）
          if (seg.underline) {
            ctx.lineWidth = seg.bold ? 7 : 1;
            this.drawLine(ctx, currentX, currentY + fontSize, charWidth, seg.color);
          }
          if (seg.strike) {
            ctx.lineWidth = seg.bold ? 7 : 1;
            this.drawLine(ctx, currentX, currentY + fontSize * 0.6, charWidth, seg.color);
          }
          currentX += charWidth;
        }
      } else {
        // 英文单词级渲染：避免单词被强制断行
        const words = seg.text.split(' ');
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const wordWidth = ctx.measureText(word).width;
          const spaceWidth = i < words.length - 1 ? ctx.measureText(' ').width : 0;

          if (currentX + wordWidth > el.x + padding + maxWidth) {
            currentY += lineHeight;
            currentX = el.x + padding;
          }
          if (seg.backgroundColor && seg.backgroundColor !== '#00000000') {
            ctx.fillStyle = seg.backgroundColor;
            ctx.fillRect(currentX, currentY, wordWidth, fontSize);
          }
          ctx.fillStyle = seg.color;
          ctx.fillText(word, currentX, currentY);

          if (seg.underline) {
            ctx.lineWidth = seg.bold ? 7 : 1;
            this.drawLine(ctx, currentX, currentY + fontSize, wordWidth, seg.color);
          }
          if (seg.strike) {
            ctx.lineWidth = seg.bold ? 7 : 1;
            this.drawLine(ctx, currentX, currentY + fontSize * 0.6, wordWidth, seg.color);
          }
          currentX += wordWidth + spaceWidth;
        }
      }
    });

    if (el.rotation) ctx.restore()
  }

  /**
   * 绘制线条工具：实现自定义装饰线
   */
  static drawLine(ctx, x, y, width, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  }

  /**
   * 绘制图像元素
   * 核心逻辑：图片异步预加载、CSS Filter 滤镜模拟、九宫格布局
   */
  static drawImageElement(ctx, el) {
    if (!el.url) return

    const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 }

    if (el.rotation) {
      ctx.save()
      ctx.translate(center.x, center.y)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-center.x, -center.y)
    }

    // 从 Map 中获取已加载的 HTMLImageElement，若无则初始化
    let img = this.imageCache.get(el.url)
    if (!img) {
      img = new Image()
      img.crossOrigin = 'anonymous' // 允许跨域图片导出（需要后端支持）
      img.src = el.url
      this.imageCache.set(el.url, img)
    }

    if (el.backgroundColor && el.backgroundColor !== '#00000000') {
      ctx.fillStyle = el.backgroundColor
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }

    // 若图片已完成下载，则应用滤镜并绘制
    if (img.complete) {
      let filter = 'none'
      if (el.filters) {
        const parts = []
        if (el.filters.grayscale) parts.push('grayscale(1)')
        if (el.filters.brightness) parts.push(`brightness(${100 + el.filters.brightness}%)`)
        if (el.filters.contrast) parts.push(`contrast(${100 + el.filters.contrast}%)`)
        if (parts.length > 0) filter = parts.join(' ')
      }
      ctx.filter = filter
      ctx.drawImage(img, el.x, el.y, el.width, el.height)
      ctx.filter = 'none' // 绘制后必须立即重置滤镜，防止污染后续渲染
    } else {
      // 预加载期间展示浅灰色占位符
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }

    if (el.stroke && el.strokeWidth > 0 && el.stroke !== '#00000000') {
      const halfStroke = el.strokeWidth / 2
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.strokeRect(
        el.x - halfStroke, el.y - halfStroke,
        el.width + el.strokeWidth, el.height + el.strokeWidth
      )
    }

    if (el.rotation) ctx.restore()
  }
}