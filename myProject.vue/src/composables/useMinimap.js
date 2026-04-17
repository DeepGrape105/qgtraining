import { computed } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useViewport } from './useViewport'

const CANVAS_WIDTH = 5000
const CANVAS_HEIGHT = 5000

export function useMinimap(minimapSize = 180) {
  const store = useCanvasStore()
  const { setViewport } = useViewport()

  const scale = minimapSize / Math.max(CANVAS_WIDTH, CANVAS_HEIGHT)

  const getViewportRect = (viewportWidth, viewportHeight) => {
    const { offsetX, offsetY, scale: viewportScale } = store.viewport

    const worldX = -offsetX / viewportScale
    const worldY = -offsetY / viewportScale
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale

    let x = (worldX / CANVAS_WIDTH) * minimapSize
    let y = (worldY / CANVAS_HEIGHT) * minimapSize
    let w = (worldW / CANVAS_WIDTH) * minimapSize
    let h = (worldH / CANVAS_HEIGHT) * minimapSize

    const clampedX = Math.max(0, Math.min(minimapSize - w, x))
    const clampedY = Math.max(0, Math.min(minimapSize - h, y))

    return { x: clampedX, y: clampedY, w, h }
  }

  const updateViewportByRect = (rectX, rectY, viewportWidth, viewportHeight) => {
    const { scale: viewportScale } = store.viewport
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale

    // 将小地图坐标转换为期望的世界坐标
    let worldX = (rectX / minimapSize) * CANVAS_WIDTH
    let worldY = (rectY / minimapSize) * CANVAS_HEIGHT

    // 应用与 useViewport 完全一致的边界限制
    worldX = Math.max(0, Math.min(CANVAS_WIDTH - worldW, worldX))
    worldY = Math.max(0, Math.min(CANVAS_HEIGHT - worldH, worldY))

    const newOffsetX = -worldX * viewportScale
    const newOffsetY = -worldY * viewportScale

    setViewport(newOffsetX, newOffsetY, viewportScale, viewportWidth, viewportHeight)
  }

  const isPointInViewportRect = (x, y, vw, vh) => {
    const r = getViewportRect(vw, vh)
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  }

  return {
    bounds: computed(() => ({ minX: 0, minY: 0, maxX: CANVAS_WIDTH, maxY: CANVAS_HEIGHT })),
    minimapScale: computed(() => scale),
    getViewportRect,
    updateViewportByRect,
    isPointInViewportRect,
    canPan: () => true // 始终允许拖拽
  }
}