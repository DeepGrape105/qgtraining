// src/composables/Renderer.js
import { useCanvasStore } from '../store/canvasStore';
import { useText } from './useText'

export default class Renderer {
  static imageCache = new Map();

  static draw(ctx, element, options = {}) {
    const store = useCanvasStore()
    if (!ctx || !element || element.isVisible === false) return

    ctx.save()
    ctx.globalAlpha = (element.opacity ?? 1) * (element.isLocked ? 0.8 : 1)

    switch (element.type) {
      case 'rect': this.drawRect(ctx, element); break
      case 'circle': this.drawCircle(ctx, element); break
      case 'triangle': this.drawTriangle(ctx, element); break
      case 'text': this.drawText(ctx, element); break
      case 'image': this.drawImageElement(ctx, element); break
    }

    if (!options.skipHighlight && store.selectedIds.includes(element.id)) {
      this.drawHighlight(ctx, element, store.viewport.scale)
    }

    ctx.restore()
  }

  static drawHighlight(ctx, el, scale) {
    let minX, minY, w, h

    if (el.type === 'triangle') {
      const xs = el.points.map(p => p.x)
      const ys = el.points.map(p => p.y)
      minX = Math.min(...xs)
      minY = Math.min(...ys)
      w = Math.max(...xs) - minX
      h = Math.max(...ys) - minY
    } else if (el.type === 'circle') {
      minX = el.x - el.radius
      minY = el.y - el.radius
      w = el.radius * 2
      h = el.radius * 2
    } else if (el.type === 'text') {
      minX = el.x
      minY = el.y
      w = el.width || 100
      h = el.height || 20
    } else {
      minX = el.x
      minY = el.y
      w = el.width
      h = el.height
    }

    const padding = 8 / scale

    ctx.save()
    ctx.strokeStyle = '#1890ff'
    ctx.lineWidth = 2 / scale
    ctx.setLineDash([])
    ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2)

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#1890ff'
    const handleSize = 10 / scale

    const corners = [
      { x: minX - padding, y: minY - padding },
      { x: minX + w + padding, y: minY - padding },
      { x: minX - padding, y: minY + h + padding },
      { x: minX + w + padding, y: minY + h + padding }
    ]

    corners.forEach(corner => {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, handleSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    })

    ctx.restore()
  }

  static drawRect(ctx, el) {
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
  }

  static drawCircle(ctx, el) {
    const radius = el.strokeWidth > 0 ? el.radius + el.strokeWidth / 2 : el.radius

    ctx.beginPath()
    ctx.arc(el.x, el.y, radius, 0, Math.PI * 2)

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor
      ctx.fill()
    }
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fill()
    }
    if (el.stroke && el.strokeWidth > 0 && el.stroke !== 'transparent') {
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.stroke()
    }
  }

  static drawTriangle(ctx, el) {
    if (!el.points || el.points.length < 3) return

    if (!el.stroke || el.strokeWidth === 0 || el.stroke === 'transparent') {
      ctx.beginPath()
      ctx.moveTo(el.points[0].x, el.points[0].y)
      ctx.lineTo(el.points[1].x, el.points[1].y)
      ctx.lineTo(el.points[2].x, el.points[2].y)
      ctx.closePath()

      if (el.backgroundColor && el.backgroundColor !== 'transparent') {
        ctx.fillStyle = el.backgroundColor
        ctx.fill()
      }
      if (el.fill) {
        ctx.fillStyle = el.fill
        ctx.fill()
      }
      return
    }

    const halfStroke = el.strokeWidth / 2
    const points = el.points
    const cx = (points[0].x + points[1].x + points[2].x) / 3
    const cy = (points[0].y + points[1].y + points[2].y) / 3

    const expandedPoints = points.map(p => {
      const dx = p.x - cx
      const dy = p.y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      return {
        x: p.x + (dx / dist) * halfStroke,
        y: p.y + (dy / dist) * halfStroke
      }
    })

    ctx.beginPath()
    ctx.moveTo(expandedPoints[0].x, expandedPoints[0].y)
    ctx.lineTo(expandedPoints[1].x, expandedPoints[1].y)
    ctx.lineTo(expandedPoints[2].x, expandedPoints[2].y)
    ctx.closePath()

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor
      ctx.fill()
    }
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fill()
    }
    ctx.strokeStyle = el.stroke
    ctx.lineWidth = el.strokeWidth
    ctx.stroke()
  }

  static drawText(ctx, el) {
    const { editingId } = useText();
    const text = String(el.text || '');
    const padding = el.padding || 8;
    const boxWidth = el.width || 200;
    const maxWidth = boxWidth - padding * 2;
    const fontSize = el.fontSize || 20;
    const fontWeight = el.fontWeight || 'normal';
    const fontFamily = el.fontFamily || 'Arial';
    const lineHeight = fontSize * 1.4;

    // --- 第一步：计算高度 ---
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const displayText = (editingId.value === el.id && text === '') ? ' ' : text;

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

    const neededHeight = tempLines.length * lineHeight + padding * 2;
    const boxHeight = Math.max(neededHeight, fontSize + padding * 2);
    el.height = boxHeight;

    // --- 第二步：计算实际需要的宽度（根据富文本）---
    const richText = el.richText || displayText;
    const segments = parseRichText(richText, el.fill || '#000000', fontSize, fontWeight, fontFamily);

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
        // 中文：逐字符
        const chars = seg.text.split('');
        for (let char of chars) {
          const testLine = line + char;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line.length > 0) {
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
            line = char;
          } else {
            line = testLine;
          }
        }
      } else {
        // 英文：按单词
        const words = seg.text.split(' ');
        for (let word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line.length > 0) {
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
            line = word;
          } else {
            line = line ? line + ' ' + word : word;
          }
        }
      }
      if (line) {
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
      }
    });

    const actualWidth = Math.max(boxWidth, maxLineWidth + padding * 2);

    // --- 第三步：绘制背景和边框（使用动态宽度）---
    if (el.backgroundColor && el.backgroundColor !== '#00000000') {
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(el.x, el.y, actualWidth, boxHeight);
    }

    if (el.stroke && el.strokeWidth > 0 && el.stroke !== '#00000000') {
      const halfStroke = el.strokeWidth / 2;
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.strokeRect(
        el.x - halfStroke,
        el.y - halfStroke,
        actualWidth + el.strokeWidth,
        boxHeight + el.strokeWidth
      );
    }

    // --- 第四步：绘制文本（编辑中不画）---
    if (editingId.value === el.id) return;

    let currentY = el.y + padding;
    let currentX = el.x + padding;

    segments.forEach(seg => {
      if (seg.text === '\n') {
        currentY += lineHeight;
        currentX = el.x + padding;
        return;
      }

      let fontStyle = '';
      if (seg.bold) fontStyle += 'bold ';
      if (seg.italic) fontStyle += 'italic ';
      ctx.font = `${fontStyle}${seg.fontSize || fontSize}px ${seg.fontFamily || fontFamily}`;
      ctx.fillStyle = seg.color;
      ctx.textBaseline = 'top';

      const isChinese = /[\u4e00-\u9fa5]/.test(seg.text);

      if (isChinese) {
        // 中文：逐字符绘制
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

          if (seg.underline) {
            this.drawLine(ctx, currentX, currentY + fontSize, charWidth, seg.color);
          }
          if (seg.strike) {
            this.drawLine(ctx, currentX, currentY + fontSize * 0.6, charWidth, seg.color);
          }

          currentX += charWidth;
        }
      } else {
        // 英文：按单词绘制
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
            this.drawLine(ctx, currentX, currentY + fontSize, wordWidth, seg.color);
          }
          if (seg.strike) {
            this.drawLine(ctx, currentX, currentY + fontSize * 0.6, wordWidth, seg.color);
          }

          currentX += wordWidth;
          if (i < words.length - 1) {
            currentX += spaceWidth;
          }
        }
      }
    });
  }

// 辅助方法：绘制线条（下划线/删除线）
static drawLine(ctx, x, y, width, color) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
}

  static drawImageElement(ctx, el) {
    if (!el.url) return

    let img = this.imageCache.get(el.url)

    if (!img) {
      img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = el.url
      this.imageCache.set(el.url, img)
    }

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }

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
      ctx.filter = 'none'
    } else {
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(el.x, el.y, el.width, el.height)
      ctx.fillStyle = '#999'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('...', el.x + el.width / 2, el.y + el.height / 2)
    }

    if (el.stroke && el.strokeWidth > 0 && el.stroke !== 'transparent') {
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
  }
}

function parseRichText(html, defaultColor, defaultSize, defaultWeight, defaultFamily) {
  const segments = [];
  let content = html.replace(/<\/?p>/g, '');
  const tagStack = [];
  let currentText = '';

  for (let i = 0; i < content.length; i++) {
    if (content[i] === '<') {
      if (currentText) {
        segments.push({
          text: currentText,
          bold: tagStack.some(t => t.includes('strong') || t.includes('<b>') || t === 'b'),
          italic: tagStack.some(t => t.includes('em') || t.includes('<i>') || t === 'i'),
          underline: tagStack.some(t => t.includes('u') || t === 'u'),
          strike: tagStack.some(t => t.includes('del') || t.includes('s') || t === 's'),
          color: getColorFromStack(tagStack) || defaultColor,
          backgroundColor: getBackgroundColorFromStack(tagStack) || '#00000000',
          fontSize: defaultSize,
          fontFamily: defaultFamily
        });
        currentText = '';
      }

      const end = content.indexOf('>', i);
      const tag = content.substring(i + 1, end);
      i = end;

      if (tag.startsWith('/')) {
        tagStack.pop();
      } else {
        tagStack.push(tag);
      }
    } else {
      currentText += content[i];
    }
  }

  if (currentText) {
    segments.push({
      text: currentText,
      bold: tagStack.some(t => t.includes('strong') || t.includes('<b>') || t === 'b'),
      italic: tagStack.some(t => t.includes('em') || t.includes('<i>') || t === 'i'),
      underline: tagStack.some(t => t.includes('u') || t === 'u'),
      strike: tagStack.some(t => t.includes('del') || t.includes('s') || t === 's'),
      color: getColorFromStack(tagStack) || defaultColor,
      backgroundColor: getBackgroundColorFromStack(tagStack) || '#00000000',
      fontSize: defaultSize,
      fontFamily: defaultFamily
    });
  }

  return segments;
}

function getColorFromStack(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const tag = stack[i];
    if (tag.includes('style=')) {
      const match = tag.match(/color:\s*([^;"]+)/);
      if (match) return match[1];
    }
  }
  return null;
}

function getBackgroundColorFromStack(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const tag = stack[i];
    // 检查 style 里的 background-color
    if (tag.includes('style=')) {
      const match = tag.match(/background-color:\s*([^;"]+)/);
      if (match) return match[1];
    }
    // 检查 <mark> 标签（TipTap 高亮默认用 mark）
    if (tag.includes('mark') || tag === 'mark') {
      return '#ffff00'; // 默认黄色高亮
    }
  }
  return null;
}