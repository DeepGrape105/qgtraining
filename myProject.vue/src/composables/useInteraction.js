import { useCanvasStore } from '../store/canvasStore'
import { isPointInElement } from '../utils/math'
import { useElements } from './useElements'
import { useViewport } from './useViewport'
import { useHistory } from './useHistory'
import { useText } from './useText'
import { onMounted, onUnmounted } from 'vue'

let globalLastClickTime = 0
let globalLastSelectedId = null

export function useInteraction() {
  const store = useCanvasStore()
  const { updateElement, setSelection, clearSelection, toggleSelection } = useElements()
  const { getViewport, panViewport, zoomIn, zoomOut } = useViewport()
  const { record } = useHistory()
  const { startEditing, editingId } = useText()

  let isDragging = false
  let isPanning = false
  let lastMousePos = { x: 0, y: 0 }
  let isMarqueeSelecting = false
  let marqueeStart = null
  let marqueeEnd = null
  let isSpacePressed = false

  const getScreenCoords = (e, canvasEl) => {
    const rect = canvasEl.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const getWorldCoords = (e, canvasEl) => {
    const screen = getScreenCoords(e, canvasEl)
    const { offsetX, offsetY, scale } = getViewport()
    return {
      x: Math.round((screen.x - offsetX) / scale * 100) / 100,
      y: Math.round((screen.y - offsetY) / scale * 100) / 100
    }
  }

  const handleKeyDown = (e) => {
    if (e.code === 'Space' && !editingId.value) {
      isSpacePressed = true
      e.preventDefault()
    }
  }

  const handleKeyUp = (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false
    }
  }

  const handleMouseDown = (e, canvasEl) => {
    if (editingId.value) return

    const worldPos = getWorldCoords(e, canvasEl)
    const now = Date.now()

    const clickedEl = [...store.elements]
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
      .find(el => isPointInElement(worldPos.x, worldPos.y, el))

    if (clickedEl) {
      if (now - globalLastClickTime < 300 && globalLastSelectedId === clickedEl.id) {
        if (clickedEl.type === 'text') {
          startEditing(clickedEl.id)
          globalLastClickTime = 0
          return
        }
      }
      globalLastClickTime = now
      globalLastSelectedId = clickedEl.id

      if (e.shiftKey) {
        toggleSelection(clickedEl.id)
        isDragging = false
      } else {
        if (store.selectedIds.includes(clickedEl.id)) {
          isDragging = true
        } else {
          setSelection(clickedEl.id)
          isDragging = false
        }
      }

      const screenPos = getScreenCoords(e, canvasEl)
      lastMousePos = { x: screenPos.x, y: screenPos.y }
      isPanning = false
      isMarqueeSelecting = false

    } else {
      if (isSpacePressed) {
        clearSelection()
        isPanning = true
        isMarqueeSelecting = false
        const screenPos = getScreenCoords(e, canvasEl)
        lastMousePos = { x: screenPos.x, y: screenPos.y }
      } else {
        if (!e.shiftKey) clearSelection()
        isMarqueeSelecting = true
        marqueeStart = worldPos
        marqueeEnd = worldPos
        isPanning = false
        isDragging = false
      }
    }
  }

  const handleMouseMove = (e, canvasEl) => {
    if (isMarqueeSelecting) {
      marqueeEnd = getWorldCoords(e, canvasEl)
      const rect = {
        x: Math.min(marqueeStart.x, marqueeEnd.x),
        y: Math.min(marqueeStart.y, marqueeEnd.y),
        width: Math.abs(marqueeEnd.x - marqueeStart.x),
        height: Math.abs(marqueeEnd.y - marqueeStart.y)
      }
      store.marqueeRect = rect

      import('../utils/math').then(({ isElementInRect }) => {
        const selected = store.elements.filter(el => isElementInRect(el, rect))
        store.selectedIds = selected.map(el => el.id)
      })
      return
    }

    if (editingId.value) return

    const screenPos = getScreenCoords(e, canvasEl)
    const dx = screenPos.x - lastMousePos.x
    const dy = screenPos.y - lastMousePos.y

    if (isDragging) {
      const { scale } = getViewport()
      const worldDx = dx / scale
      const worldDy = dy / scale

      store.selectedIds.forEach(id => {
        const el = store.elements.find(e => e.id === id)
        if (el) {
          if (el.type === 'triangle') {
            updateElement(id, {
              points: el.points.map(p => ({ x: p.x + worldDx, y: p.y + worldDy }))
            })
          } else {
            updateElement(id, { x: el.x + worldDx, y: el.y + worldDy })
          }
        }
      })
    } else if (isPanning) {
      panViewport(dx, dy)
    }

    lastMousePos = { x: screenPos.x, y: screenPos.y }
  }

  const handleMouseUp = () => {
    if (isMarqueeSelecting) {
      isMarqueeSelecting = false
      marqueeStart = null
      marqueeEnd = null
      store.marqueeRect = null
    }
    if (isDragging) record()
    isDragging = false
    isPanning = false
  }

  const handleWheel = (e, canvasEl) => {
    e.preventDefault()

    if (e.ctrlKey || e.metaKey) {
      const screenPos = getScreenCoords(e, canvasEl)
      e.deltaY < 0 ? zoomIn(screenPos.x, screenPos.y) : zoomOut(screenPos.x, screenPos.y)
    } else {
      panViewport(-e.deltaX, -e.deltaY)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  })

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel
  }
}