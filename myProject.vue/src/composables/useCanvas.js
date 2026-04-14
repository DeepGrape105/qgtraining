// src/composables/useCanvas.js
import { useCanvasStore } from '../store/canvasStore'
import Renderer from './Renderer'

export function useCanvas() {
  const store = useCanvasStore()
  let ctx = null
  let canvas = null
  let animationFrameId = null

  const initCanvas = (canvasEl) => {
    canvas = canvasEl
    ctx = canvas.getContext('2d')

    // 画布占满整个容器
    const resizeCanvas = () => {
      const container = canvas.parentElement
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
  }

  /**
   * 绘制无限网格背景
   */
  const drawInfiniteGrid = (ctx, offsetX, offsetY, scale, gridSize, width, height) => {
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    // 用能工作的红色版本，只改颜色
    ctx.strokeStyle = '#e5e7eb'  // 浅灰色
    ctx.lineWidth = 0.8 / scale

    const step = 50  // 固定 50px
    const worldLeft = -offsetX / scale
    const worldTop = -offsetY / scale
    const worldRight = worldLeft + width / scale
    const worldBottom = worldTop + height / scale

    const startX = Math.floor(worldLeft / step) * step
    const startY = Math.floor(worldTop / step) * step

    ctx.beginPath()

    for (let x = startX; x <= worldRight; x += step) {
      ctx.moveTo(x, worldTop)
      ctx.lineTo(x, worldBottom)
    }

    for (let y = startY; y <= worldBottom; y += step) {
      ctx.moveTo(worldLeft, y)
      ctx.lineTo(worldRight, y)
    }

    ctx.stroke()
    ctx.restore()
  }

  const renderLoop = () => {
    if (!ctx || !canvas) return

    const { backgroundColor, showGrid, gridSize } = store.canvasConfig
    const { offsetX, offsetY, scale } = store.viewport
    const width = canvas.width
    const height = canvas.height

    // 1. 清空画布
    ctx.clearRect(0, 0, width, height)

    // 2. 画背景色
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // 3. 画网格
    if (showGrid) {
      drawInfiniteGrid(ctx, offsetX, offsetY, scale, gridSize, width, height)
    }

    // 4. 画所有图形（不含选中框）
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    const sortedElements = [...store.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const el of sortedElements) {
      Renderer.draw(ctx, el, { skipHighlight: true })
    }

    // 5. 画框选矩形
    if (store.marqueeRect) {
      const rect = store.marqueeRect
      ctx.strokeStyle = '#1890ff'
      ctx.lineWidth = 1.5 / scale
      ctx.setLineDash([5 / scale, 5 / scale])
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      ctx.fillStyle = 'rgba(24, 144, 255, 0.1)'
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
      ctx.setLineDash([])
    }

    // 6. 画选中框：单选时画单个，多选时画整体包围盒
    if (store.selectedIds.length === 1) {
      // 单选：画单个元素的选中框
      const el = store.elements.find(e => e.id === store.selectedIds[0])
      if (el) {
        Renderer.drawHighlight(ctx, el, scale)
      }
    } else if (store.selectedIds.length > 1) {
      // 多选：画整体包围盒
      const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      selectedElements.forEach(el => {
        if (el.type === 'circle') {
          minX = Math.min(minX, el.x - el.radius)
          minY = Math.min(minY, el.y - el.radius)
          maxX = Math.max(maxX, el.x + el.radius)
          maxY = Math.max(maxY, el.y + el.radius)
        } else if (el.type === 'triangle') {
          el.points.forEach(p => {
            minX = Math.min(minX, p.x)
            minY = Math.min(minY, p.y)
            maxX = Math.max(maxX, p.x)
            maxY = Math.max(maxY, p.y)
          })
        } else {
          minX = Math.min(minX, el.x)
          minY = Math.min(minY, el.y)
          maxX = Math.max(maxX, el.x + (el.width || 0))
          maxY = Math.max(maxY, el.y + (el.height || 0))
        }
      })

      const padding = 8 / scale
      const w = maxX - minX
      const h = maxY - minY

      // 画虚线包围盒
      ctx.strokeStyle = '#1890ff'
      ctx.lineWidth = 2 / scale
      ctx.setLineDash([5 / scale, 5 / scale])
      ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2)

      // 画四角手柄
      ctx.setLineDash([])
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
    }

    ctx.restore()

    animationFrameId = requestAnimationFrame(renderLoop)
  }

  const stopLoop = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
  }

  return { initCanvas, renderLoop, stopLoop }
}