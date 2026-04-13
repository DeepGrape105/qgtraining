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

    // 1. 清空整个画布
    ctx.clearRect(0, 0, width, height)

    // 2. 画背景色
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // 3. 画无限网格（如果开启）
    if (showGrid) {
      drawInfiniteGrid(ctx, offsetX, offsetY, scale, gridSize, width, height)
    }

    // 4. 画所有图形
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    const sortedElements = [...store.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const el of sortedElements) {
      Renderer.draw(ctx, el)
    }

    // 画框选矩形
    if (store.marqueeRect) {
      const rect = store.marqueeRect

      ctx.save()
      ctx.translate(offsetX, offsetY)
      ctx.scale(scale, scale)

      ctx.strokeStyle = '#1890ff'
      ctx.lineWidth = 1.5 / scale
      ctx.setLineDash([5 / scale, 5 / scale])
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

      ctx.fillStyle = 'rgba(24, 144, 255, 0.1)'
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)

      ctx.setLineDash([])
      ctx.restore()
    }

    // 5. 画选中框
    if (store.selection) {
      const selectedEl = store.elements.find(el => el.id === store.selection)
      if (selectedEl) {
        Renderer.drawHighlight(ctx, selectedEl)
      }
    }

    ctx.restore()

    animationFrameId = requestAnimationFrame(renderLoop)
  }

  const stopLoop = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
  }

  return { initCanvas, renderLoop, stopLoop }
}