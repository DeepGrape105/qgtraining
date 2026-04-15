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
    const { editingId } = useText()
    const text = String(el.text || '')

    if (text.trim() === '' && editingId.value !== el.id) {
      el.height = 0
      return
    }

    const fontSize = el.fontSize || 20
    const fontWeight = el.fontWeight || 'normal'
    const fontFamily = el.fontFamily || 'Arial'
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    ctx.textBaseline = 'top'

    const padding = el.padding || 8
    const boxWidth = el.width || 200
    const maxWidth = boxWidth - padding * 2
    const lineHeight = fontSize * 1.4

    const displayText = (editingId.value === el.id && text === '') ? ' ' : text

    const chars = displayText.split('')
    const lines = []
    let currentLine = ''

    for (let char of chars) {
      if (char === '\n') {
        lines.push(currentLine)
        currentLine = ''
        continue
      }
      const testLine = currentLine + char
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    if (currentLine || text.endsWith('\n')) {
      lines.push(currentLine)
    }

    if (lines.length === 0 && editingId.value === el.id) {
      lines.push(' ')
    }

    const neededHeight = lines.length * lineHeight + padding * 2
    const boxHeight = Math.max(neededHeight, fontSize + padding * 2)

    if (el.backgroundColor && el.backgroundColor !== '#00000000') {
      ctx.fillStyle = el.backgroundColor
      ctx.fillRect(el.x, el.y, boxWidth, boxHeight)
    }

    if (el.stroke && el.strokeWidth > 0 && el.stroke !== '#00000000') {
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

    if (editingId.value !== el.id) {
      const richText = el.richText || displayText
      const segments = parseRichText(richText, el.fill || '#000000', fontSize, fontWeight, fontFamily)

      if (segments.length === 0) {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
        ctx.fillStyle = el.fill || '#000000'
        lines.forEach((line, index) => {
          ctx.fillText(line, el.x + padding, el.y + padding + index * lineHeight)
        })
      } else {
        let currentY = el.y + padding
        let currentX = el.x + padding
        let currentLineHeight = lineHeight

        segments.forEach(seg => {
          if (seg.text === '\n') {
            currentY += currentLineHeight
            currentX = el.x + padding
            currentLineHeight = lineHeight
            return
          }

          let fontStyle = ''
          if (seg.bold) fontStyle += 'bold '
          if (seg.italic) fontStyle += 'italic '
          ctx.font = `${fontStyle}${seg.fontSize || fontSize}px ${seg.fontFamily || fontFamily}`
          ctx.fillStyle = seg.color

          const words = seg.text.split('')
          let line = ''

          for (let char of words) {
            const testLine = line + char
            const metrics = ctx.measureText(testLine)

            if (metrics.width > maxWidth && line.length > 0) {
              ctx.fillText(line, currentX, currentY)

              if (seg.underline) {
                const lineWidth = ctx.measureText(line).width
                ctx.beginPath()
                ctx.strokeStyle = seg.color
                ctx.lineWidth = 1
                ctx.moveTo(currentX, currentY + seg.fontSize * 1.1)
                ctx.lineTo(currentX + lineWidth, currentY + seg.fontSize * 1.1)
                ctx.stroke()
              }

              if (seg.strike) {
                const lineWidth = ctx.measureText(line).width
                ctx.beginPath()
                ctx.strokeStyle = seg.color
                ctx.lineWidth = 1
                ctx.moveTo(currentX, currentY + seg.fontSize * 0.6)
                ctx.lineTo(currentX + lineWidth, currentY + seg.fontSize * 0.6)
                ctx.stroke()
              }

              line = char
              currentY += currentLineHeight
              currentX = el.x + padding
              currentLineHeight = lineHeight
            } else {
              line = testLine
            }
          }

          if (line) {
            ctx.fillText(line, currentX, currentY)

            if (seg.underline) {
              const lineWidth = ctx.measureText(line).width
              ctx.beginPath()
              ctx.strokeStyle = seg.color
              ctx.lineWidth = 1
              ctx.moveTo(currentX, currentY + seg.fontSize * 1.1)
              ctx.lineTo(currentX + lineWidth, currentY + seg.fontSize * 1.1)
              ctx.stroke()
            }

            if (seg.strike) {
              const lineWidth = ctx.measureText(line).width
              ctx.beginPath()
              ctx.strokeStyle = seg.color
              ctx.lineWidth = 1
              ctx.moveTo(currentX, currentY + seg.fontSize * 0.6)
              ctx.lineTo(currentX + lineWidth, currentY + seg.fontSize * 0.6)
              ctx.stroke()
            }

            currentX += ctx.measureText(line).width
          }
        })
      }
    }
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
  const segments = []
  let content = html.replace(/<\/?p>/g, '')
  const tagStack = []
  let currentText = ''

  for (let i = 0; i < content.length; i++) {
    if (content[i] === '<') {
      if (currentText) {
        segments.push({
          text: currentText,
          bold: tagStack.includes('strong') || tagStack.includes('b'),
          italic: tagStack.includes('em') || tagStack.includes('i'),
          underline: tagStack.includes('u'),
          strike: tagStack.includes('del') || tagStack.includes('s'),
          color: getColorFromStack(tagStack) || defaultColor,
          fontSize: defaultSize,
          fontFamily: defaultFamily
        })
        currentText = ''
      }

      const end = content.indexOf('>', i)
      const tag = content.substring(i + 1, end)
      i = end

      if (tag.startsWith('/')) {
        tagStack.pop()
      } else {
        tagStack.push(tag.split(' ')[0])
      }
    } else {
      currentText += content[i]
    }
  }

  if (currentText) {
    segments.push({
      text: currentText,
      bold: tagStack.includes('strong') || tagStack.includes('b'),
      italic: tagStack.includes('em') || tagStack.includes('i'),
      underline: tagStack.includes('u'),
      strike: tagStack.includes('del') || tagStack.includes('s'),
      color: getColorFromStack(tagStack) || defaultColor,
      fontSize: defaultSize,
      fontFamily: defaultFamily
    })
  }

  return segments
}

function getColorFromStack(stack) {
  for (let tag of stack) {
    if (tag.startsWith('span') && tag.includes('color')) {
      const match = tag.match(/color:\s*([^;"]+)/)
      if (match) return match[1]
    }
  }
  return null
}