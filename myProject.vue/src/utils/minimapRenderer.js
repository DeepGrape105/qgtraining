export function drawMinimap(ctx, size, bounds, minimapScale, getViewportRect, vw, vh) {
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 0.5
  const gridStep = 250 * minimapScale.value
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

  ctx.strokeStyle = '#ff4d4f'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.strokeRect(0, 0, size, size)
  ctx.setLineDash([])

  const rect = getViewportRect(vw, vh)

  ctx.fillStyle = 'rgba(24, 144, 255, 0.15)'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = '#1890ff'
  ctx.lineWidth = 2
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

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

export function drawPreview(ctx, size, store) {
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  const { offsetX, offsetY, scale } = store.viewport
  const worldX = -offsetX / scale
  const worldY = -offsetY / scale
  const worldW = size / scale
  const worldH = size / scale

  ctx.fillStyle = 'rgba(24, 144, 255, 0.1)'
  ctx.strokeStyle = 'rgba(24, 144, 255, 0.5)'
  ctx.lineWidth = 1.5

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

    if (x + w > worldX && x < worldX + worldW && y + h > worldY && y < worldY + worldH) {
      const rx = (x - worldX) * scale
      const ry = (y - worldY) * scale
      const rw = w * scale
      const rh = h * scale
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeRect(rx, ry, rw, rh)
    }
  })
}