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

    const resizeCanvas = () => {
      const container = canvas.parentElement
      const dpr = window.devicePixelRatio || 1

      // 获取容器的逻辑尺寸
      const width = container.clientWidth
      const height = container.clientHeight

      // 1. 设置画布的实际渲染像素（物理像素）
      canvas.width = width * dpr
      canvas.height = height * dpr

      // 2. 通过 CSS 将画布缩放回原来的逻辑尺寸
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'

      // 3. 【关键】全局缩放上下文，后续所有的绘制代码依然按照逻辑坐标写，无需改动
      ctx.scale(dpr, dpr)
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
  }

  const drawGroupHighlight = (ctx, elements, scale) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    elements.forEach(el => {
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
    const center = { x: minX + w / 2, y: minY + h / 2 }

    // 🌟 紫色组合框
    ctx.save()
    ctx.strokeStyle = '#9c27b0'
    ctx.lineWidth = 2.5 / scale
    ctx.setLineDash([])
    ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2)

    // 四角手柄
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#9c27b0'
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

    // 旋转手柄
    const rotateHandleDistance = 28 / scale
    const rotateHandle = {
      x: center.x,
      y: minY - padding - rotateHandleDistance
    }

    ctx.beginPath()
    ctx.strokeStyle = '#9c27b0'
    ctx.lineWidth = 1.5 / scale
    ctx.moveTo(center.x, minY - padding)
    ctx.lineTo(rotateHandle.x, rotateHandle.y)
    ctx.stroke()

    ctx.beginPath()
    ctx.fillStyle = '#9c27b0'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    ctx.shadowBlur = 4 / scale
    ctx.arc(rotateHandle.x, rotateHandle.y, handleSize / 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'

    ctx.beginPath()
    ctx.fillStyle = '#ffffff'
    ctx.arc(rotateHandle.x - 2 / scale, rotateHandle.y - 2 / scale, handleSize / 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const drawMultiSelectHighlight = (ctx, elements, scale, isSameGroup) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    elements.forEach(el => {
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
    const center = { x: minX + w / 2, y: minY + h / 2 }

    const boxColor = '#1890ff'  // 蓝色

    ctx.save()
    ctx.strokeStyle = boxColor
    ctx.lineWidth = 2 / scale
    ctx.setLineDash([5 / scale, 5 / scale])
    ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2)
    ctx.setLineDash([])

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = boxColor
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

    // 旋转手柄
    const rotateHandleDistance = 28 / scale
    const rotateHandle = {
      x: center.x,
      y: minY - padding - rotateHandleDistance
    }

    ctx.beginPath()
    ctx.strokeStyle = boxColor
    ctx.lineWidth = 1.5 / scale
    ctx.moveTo(center.x, minY - padding)
    ctx.lineTo(rotateHandle.x, rotateHandle.y)
    ctx.stroke()

    ctx.beginPath()
    ctx.fillStyle = '#4CAF50'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    ctx.shadowBlur = 4 / scale
    ctx.arc(rotateHandle.x, rotateHandle.y, handleSize / 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'

    ctx.beginPath()
    ctx.fillStyle = '#ffffff'
    ctx.arc(rotateHandle.x - 2 / scale, rotateHandle.y - 2 / scale, handleSize / 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
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

    // 使用逻辑尺寸而不是物理像素尺寸
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // 1. 清空画布 (注意：因为 initCanvas 里 scale(dpr) 了，这里清空需要覆盖物理范围)
    // 最稳妥的方法是重置变换再清空，或者清空逻辑尺寸的超大范围
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // 重置所有变换
    ctx.clearRect(0, 0, canvas.width, canvas.height) // 按物理像素清空
    ctx.restore()

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

    // 6. 画选中框：优化逻辑，避免重复绘制
    const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))

    // 🌟 分析选中情况
    const groupIds = [...new Set(selectedElements.map(el => el.groupId).filter(Boolean))]
    const nonGroupElements = selectedElements.filter(el => !el.groupId)

    // 情况1：只选中了一个元素
    if (selectedElements.length === 1) {
      const el = selectedElements[0]
      // 如果元素属于组合，不画单独选中框（组合框会在下面画）
      if (!el.groupId) {
        Renderer.drawHighlight(ctx, el, scale)
      }
    }

    // 情况2：选中了多个元素
    else if (selectedElements.length > 1) {
      // 🌟 检查是否只选中了完整的组合
      const allGroupElementsComplete = groupIds.every(groupId => {
        const groupElements = store.elements.filter(el => el.groupId === groupId)
        const selectedInGroup = selectedElements.filter(el => el.groupId === groupId)
        // 检查组合内的所有元素是否都被选中
        return groupElements.length === selectedInGroup.length
      })

      // 如果选中的元素全部属于完整组合，且没有额外的非组合元素
      if (allGroupElementsComplete && nonGroupElements.length === 0) {
        // 只画紫色组合框，不画蓝色多选框
        groupIds.forEach(groupId => {
          const groupElements = store.elements.filter(el => el.groupId === groupId)
          if (groupElements.length > 0) {
            drawGroupHighlight(ctx, groupElements, scale)
          }
        })
      }
      // 否则，画蓝色多选框
      else {
        // 收集所有要绘制包围盒的元素
        const allElementsForBoundingBox = [...nonGroupElements]

        groupIds.forEach(groupId => {
          const groupElements = store.elements.filter(el => el.groupId === groupId)
          allElementsForBoundingBox.push(...groupElements)
        })

        nonGroupElements.forEach(el => {
          Renderer.drawHighlight(ctx, el, scale)
        })

        if (allElementsForBoundingBox.length > 0) {
          drawMultiSelectHighlight(ctx, allElementsForBoundingBox, scale, false)
        }

        // 🌟 如果还有完整的组合，额外绘制紫色组合框（表示这些元素是组合关系）
        groupIds.forEach(groupId => {
          const groupElements = store.elements.filter(el => el.groupId === groupId)
          const selectedInGroup = selectedElements.filter(el => el.groupId === groupId)

          // 只有当组合被完整选中时，才额外绘制紫色框作为标识
          if (groupElements.length === selectedInGroup.length) {
            drawGroupHighlight(ctx, groupElements, scale)
          }
        })
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