// src/utils/minimapRenderer.js
import { useCanvasStore } from '../store/canvasStore'

export function drawMinimap(ctx, size, bounds, minimapScale, getViewportRect, vw, vh) {
  const store = useCanvasStore()

  ctx.clearRect(0, 0, size, size)

  // 背景
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, size, size)

  // 绘制网格（根据动态边界调整网格密度）
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 0.5
  const b = bounds.value
  const canvasWidth = b.maxX - b.minX
  const canvasHeight = b.maxY - b.minY
  const gridStep = Math.max(50, Math.min(250, canvasWidth / 20)) * minimapScale.value

  for (let i = 0; i <= size; i += gridStep) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(size, i)
    ctx.stroke()
  }

  // 绘制元素轮廓
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
  ctx.lineWidth = 0.5

  const s = minimapScale.value

  store.elements.forEach(el => {
    let x, y, w, h

    if (el.type === 'circle') {
      x = el.x - el.radius
      y = el.y - el.radius
      w = el.radius * 2
      h = el.radius * 2
    } else if (el.type === 'triangle') {
      const xs = el.points.map(p => p.x)
      const ys = el.points.map(p => p.y)
      x = Math.min(...xs)
      y = Math.min(...ys)
      w = Math.max(...xs) - x
      h = Math.max(...ys) - y
    } else {
      x = el.x
      y = el.y
      w = el.width || 0
      h = el.height || 0
    }

    const minimapX = (x - b.minX) * s
    const minimapY = (y - b.minY) * s
    const minimapW = w * s
    const minimapH = h * s

    if (minimapW >= 1 && minimapH >= 1) {
      ctx.fillRect(minimapX, minimapY, minimapW, minimapH)
      ctx.strokeRect(minimapX, minimapY, minimapW, minimapH)
    }
  })

  // 绘制视口矩形
  const rect = getViewportRect(vw, vh)

  ctx.fillStyle = 'rgba(24, 144, 255, 0.12)'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = '#1890ff'
  ctx.lineWidth = 2
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

  // 四角把手
  ctx.fillStyle = '#1890ff'
  const handle = 4
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.w - handle, rect.y],
    [rect.x, rect.y + rect.h - handle],
    [rect.x + rect.w - handle, rect.y + rect.h - handle]
  ]
  corners.forEach(([x, y]) => { ctx.fillRect(x, y, handle, handle) })
}