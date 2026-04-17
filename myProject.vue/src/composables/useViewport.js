import { useCanvasStore } from '../store/canvasStore'

export function useViewport() {
  const store = useCanvasStore()

  const getViewport = () => store.viewport

  const panViewport = (dx, dy) => {
    store.viewport.offsetX += dx
    store.viewport.offsetY += dy
  }

  const zoomIn = (centerX, centerY) => {
    const { scale, offsetX, offsetY } = store.viewport
    const newScale = Math.min(scale * 1.1, 5)
    if (newScale === scale) return

    const ratio = newScale / scale
    store.viewport.offsetX = centerX - (centerX - offsetX) * ratio
    store.viewport.offsetY = centerY - (centerY - offsetY) * ratio
    store.viewport.scale = newScale
  }

  const zoomOut = (centerX, centerY) => {
    const { scale, offsetX, offsetY } = store.viewport
    const newScale = Math.max(scale * 0.9, 0.1)
    if (newScale === scale) return

    const ratio = newScale / scale
    store.viewport.offsetX = centerX - (centerX - offsetX) * ratio
    store.viewport.offsetY = centerY - (centerY - offsetY) * ratio
    store.viewport.scale = newScale
  }

  const setViewport = (offsetX, offsetY, scale) => {
    store.viewport.offsetX = offsetX
    store.viewport.offsetY = offsetY
    store.viewport.scale = Math.min(5, Math.max(0.1, scale))
  }

  return { getViewport, panViewport, zoomIn, zoomOut, setViewport}
}