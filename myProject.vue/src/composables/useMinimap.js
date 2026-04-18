// src/composables/useMinimap.js
import { computed } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useViewport } from './useViewport'

export function useMinimap(minimapSize = 180) {
  const store = useCanvasStore()
  const { setViewport } = useViewport()

  // 🌟 动态计算所有元素的边界
  const bounds = computed(() => {
    if (store.elements.length === 0) {
      // 没有元素时，默认显示 0~5000 范围
      return { minX: 0, minY: 0, maxX: 5000, maxY: 5000 }
    }

    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    store.elements.forEach(el => {
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

    // 添加边距，让元素不贴边
    const padding = 200
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    }
  })

  // 小地图缩放比例（根据动态边界计算）
  const minimapScale = computed(() => {
    const b = bounds.value
    const width = b.maxX - b.minX
    const height = b.maxY - b.minY
    return minimapSize / Math.max(width, height)
  })

  // 世界坐标 → 小地图坐标
  const worldToMinimap = (worldX, worldY) => {
    const b = bounds.value
    const s = minimapScale.value
    return {
      x: (worldX - b.minX) * s,
      y: (worldY - b.minY) * s
    }
  }

  // 获取视口矩形
  const getViewportRect = (viewportWidth, viewportHeight) => {
    const { offsetX, offsetY, scale: viewportScale } = store.viewport
    const b = bounds.value
    const s = minimapScale.value

    const worldX = -offsetX / viewportScale
    const worldY = -offsetY / viewportScale
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale

    let x = (worldX - b.minX) * s
    let y = (worldY - b.minY) * s
    const w = worldW * s
    const h = worldH * s

    return {
      x: Math.max(0, Math.min(minimapSize - w, x)),
      y: Math.max(0, Math.min(minimapSize - h, y)),
      w: Math.min(w, minimapSize),
      h: Math.min(h, minimapSize)
    }
  }

  // 拖拽矩形更新视口
  const updateViewportByRect = (rectX, rectY, viewportWidth, viewportHeight) => {
    const b = bounds.value
    const s = minimapScale.value
    const { scale: viewportScale } = store.viewport
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale

    // 将小地图坐标转换为世界坐标
    let worldX = rectX / s + b.minX
    let worldY = rectY / s + b.minY

    // 边界限制
    worldX = Math.max(b.minX, Math.min(b.maxX - worldW, worldX))
    worldY = Math.max(b.minY, Math.min(b.maxY - worldH, worldY))

    const newOffsetX = -worldX * viewportScale
    const newOffsetY = -worldY * viewportScale

    setViewport(newOffsetX, newOffsetY, viewportScale, viewportWidth, viewportHeight)
  }

  const isPointInViewportRect = (x, y, vw, vh) => {
    const r = getViewportRect(vw, vh)
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  }

  const canPan = (viewportWidth, viewportHeight) => {
    const b = bounds.value
    const { scale: viewportScale } = store.viewport
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale
    return worldW < (b.maxX - b.minX) || worldH < (b.maxY - b.minY)
  }

  return {
    bounds,
    minimapScale,
    worldToMinimap,
    getViewportRect,
    updateViewportByRect,
    isPointInViewportRect,
    canPan
  }
}