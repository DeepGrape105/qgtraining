/**
   * 内部状态（isDragging, isPanning, lastMousePos）
   * 坐标工具（getScreenCoords, getWorldCoords）
   * 事件处理（handleMouseDown, handleMouseMove, handleMouseUp, handleWheel）
   */

//引用依赖项
import { useCanvasStore } from '../store/canvasStore'
import { isPointInElement } from '../utils/math'
import { useElements } from './useElements'
import { useViewport } from './useViewport'

export function useInteraction() {
  const store = useCanvasStore()
  const { updateElement, updateSelected, setSelection, clearSelection, getSelectedElement } = useElements()
  const { getViewport, panViewport, zoomIn, zoomOut } = useViewport()

  //内部状态，用于跟踪当前是否在拖动元素或平移视口，以及上一次鼠标位置
  let isDragging = false
  let isPanning = false
  let lastMousePos = { x: 0, y: 0 }

  // 获取鼠标在屏幕上的坐标
  const getScreenCoords = (e, canvasEl) => {
    const rect = canvasEl.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // 获取图形在无限画布上的坐标
  const getWorldCoords = (e, canvasEl) => {
    const screen = getScreenCoords(e, canvasEl)
    const { offsetX, offsetY, scale } = getViewport()
    return {
      x: (screen.x - offsetX) / scale,
      y: (screen.y - offsetY) / scale
    }
  }

  const handleMouseDown = (e, canvasEl) => {
    const screenPos = getScreenCoords(e, canvasEl)
    lastMousePos = { x: screenPos.x, y: screenPos.y }

    const worldPos = getWorldCoords(e, canvasEl)

    const target = [...store.elements]
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
      .find(el => isPointInElement(worldPos.x, worldPos.y, el))

    if (target) {
      setSelection(target.id)
      isDragging = true
      isPanning = false
    } else {
      clearSelection()
      isPanning = true
      isDragging = false
    }
  }

  const handleMouseMove = (e, canvasEl) => {
    const screenPos = getScreenCoords(e, canvasEl)
    const dx = screenPos.x - lastMousePos.x
    const dy = screenPos.y - lastMousePos.y

    if (isDragging && store.selection) {
      const { scale } = getViewport()
      const worldDx = dx / scale
      const worldDy = dy / scale

      const element = getSelectedElement()
      if (element) {
        if (element.type === 'triangle') {
          const newPoints = element.points.map(p => ({
            x: p.x + worldDx,
            y: p.y + worldDy
          }))
          updateElement(element.id, { points: newPoints })
        } else {
          updateSelected({
            x: element.x + worldDx,
            y: element.y + worldDy
          })
        }
      }
    } else if (isPanning) {
      panViewport(dx, dy)
    }

    lastMousePos = { x: screenPos.x, y: screenPos.y }
  }

  const handleMouseUp = () => {
    isDragging = false
    isPanning = false
  }

  const handleWheel = (e, canvasEl) => {
    e.preventDefault()
    const screenPos = getScreenCoords(e, canvasEl)

    if (e.deltaY < 0) {
      zoomIn(screenPos.x, screenPos.y)
    } else {
      zoomOut(screenPos.x, screenPos.y)
    }
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel
  }
}