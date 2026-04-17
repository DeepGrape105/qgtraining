/**
  * 
  */
import { useCanvasStore } from '../store/canvasStore'

export function useViewport() {
  const store = useCanvasStore()

  /**
   * 获取当前视口状态
   */
  const getViewport = () => {
    return { ...store.viewport }
  }

  /**
   * 设置视口（部分更新）
   */
  const setViewport = (viewport) => {
    store.viewport = { ...store.viewport, ...viewport }
  }

  /**
   * 重置视口
   */
  const resetViewport = () => {
    store.viewport = { offsetX: 0, offsetY: 0, scale: 1 }
  }

  const MIN_SCALE = 0.15;
  const MAX_SCALE = 4.0;
  /**
   * 放大（以指定屏幕坐标为中心）
   */
  const zoomIn = (centerX, centerY) => {
    const newScale = Math.min(store.viewport.scale * 1.2, MAX_SCALE)  
    const scaleChange = newScale / store.viewport.scale
    store.viewport.offsetX = centerX - (centerX - store.viewport.offsetX) * scaleChange
    store.viewport.offsetY = centerY - (centerY - store.viewport.offsetY) * scaleChange
    store.viewport.scale = newScale
  }

  /**
   * 缩小（以指定屏幕坐标为中心）
   */
  const zoomOut = (centerX, centerY) => {
    const newScale = Math.max(store.viewport.scale * 0.8, MIN_SCALE)  
    const scaleChange = newScale / store.viewport.scale
    store.viewport.offsetX = centerX - (centerX - store.viewport.offsetX) * scaleChange
    store.viewport.offsetY = centerY - (centerY - store.viewport.offsetY) * scaleChange
    store.viewport.scale = newScale
  }

  /**
   * 平移视口
   */
  const panViewport = (dx, dy) => {
    store.viewport.offsetX += dx
    store.viewport.offsetY += dy
  }

  return {
    getViewport,
    setViewport,
    resetViewport,
    zoomIn,
    zoomOut,
    panViewport
  }
}