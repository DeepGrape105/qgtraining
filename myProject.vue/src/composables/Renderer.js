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

    // 如果没跳过，画选中框（但我们现在不用这里画了）
    if (!options.skipHighlight && store.selectedIds.includes(element.id)) {
      this.drawHighlight(ctx, element, store.viewport.scale)
    }

    ctx.restore()
  }

  /**
   * 统一绘制矩形选中框 (Goodnotes 风格)
   * 逻辑：无论什么形状，先计算出左上角(minX, minY)和宽高(w, h)
   */
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
    ctx.setLineDash([]) // 实线
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

    // 背景色
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor
      ctx.fill()
    }
    // 填充色
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fill()
    }
    // 边框
    if (el.stroke && el.strokeWidth > 0 && el.stroke !== 'transparent') {
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.stroke()
    }
  }

  static drawTriangle(ctx, el) {
    if (!el.points || el.points.length < 3) return

    // 如果无边框，直接用原始顶点
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

    // 有边框：顶点向外扩展
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

    // 背景色
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor
      ctx.fill()
    }
    // 填充色
    if (el.fill) {
      ctx.fillStyle = el.fill
      ctx.fill()
    }
    // 边框
    ctx.strokeStyle = el.stroke
    ctx.lineWidth = el.strokeWidth
    ctx.stroke()
  }

  static drawText(ctx, el) {
    const { editingId } = useText()
    const text = String(el.text || '')

    // 【需求4】空文本且不在编辑状态 → 不绘制，将高度重置为0隐藏
    if (text.trim() === '' && editingId.value !== el.id) {
      el.height = 0
      return
    }

    const fontSize = el.fontSize || 20
    const fontWeight = el.fontWeight || 'normal'
    const fontFamily = 'Arial'
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    ctx.textBaseline = 'top'

    const padding = el.padding || 8
    const boxWidth = el.width || 200
    const maxWidth = boxWidth - padding * 2
    const lineHeight = fontSize * 1.4

    // 编辑状态下，即使为空也显示一个空格占位符，防止高度塌陷，让鼠标能闪烁
    const displayText = (editingId.value === el.id && text === '') ? ' ' : text

    // 自动换行 + 识别回车换行
    const chars = displayText.split('')
    const lines = []
    let currentLine = ''

    for (let char of chars) {
      if (char === '\n') { // 支持 Shift+Enter 手动换行
        lines.push(currentLine)
        currentLine = ''
        continue
      }
      const testLine = currentLine + char
      const metrics = ctx.measureText(testLine)

      // 超过宽度，且当前行有字了，就折行
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    // 推入最后一行（或者以回车结尾产生的新空行）
    if (currentLine || text.endsWith('\n')) {
      lines.push(currentLine)
    }

    // 保底：保证至少有一行的高度
    if (lines.length === 0 && editingId.value === el.id) {
      lines.push(' ')
    }

    const neededHeight = lines.length * lineHeight + padding * 2
    const boxHeight = Math.max(neededHeight, fontSize + padding * 2)

    // 1. 背景色
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor
      ctx.fillRect(el.x, el.y, boxWidth, boxHeight)
    }

    // 2. 画边框 (你要求加上的逻辑)
    if (el.stroke && el.strokeWidth > 0 && el.stroke !== 'transparent') {
      const halfStroke = el.strokeWidth / 2
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth
      ctx.strokeRect(
        el.x - halfStroke,
        el.y - halfStroke,
        boxWidth + el.strokeWidth,
        boxHeight + el.strokeWidth
      )
    }

    // 3. 画文字（编辑中不画，让 TextEditor 显示）
    if (editingId.value !== el.id) {
      ctx.fillStyle = el.fill || '#000000'
      lines.forEach((line, index) => {
        ctx.fillText(line, el.x + padding, el.y + padding + index * lineHeight)
      })
    }

    // 4. 将算好的高度反馈给元素属性
    el.height = boxHeight
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

    // 1. 背景色
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor
      ctx.fillRect(el.x, el.y, el.width, el.height)
    }

    // 2. 画图片
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
      // 加载中占位符
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(el.x, el.y, el.width, el.height)
      ctx.fillStyle = '#999'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('加载中...', el.x + el.width / 2, el.y + el.height / 2)
    }

    // 3. 边框（向外）
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