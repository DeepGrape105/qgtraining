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

  // 交互状态
  let isDragging = false
  let isPanning = false
  let lastMousePos = { x: 0, y: 0 }
  let isMarqueeSelecting = false
  let marqueeStart = null
  let marqueeEnd = null
  let isSpacePressed = false

  // 缩放状态
  let isResizing = false
  let resizeHandle = null
  let resizeStartPos = { x: 0, y: 0 }
  let resizeStartSize = { width: 0, height: 0, x: 0, y: 0, points: null, radius: null }

  const getScreenCoords = (e, canvasEl) => {
    const rect = canvasEl.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const getWorldCoords = (e, canvasEl) => {
    const screen = getScreenCoords(e, canvasEl)
    const { offsetX, offsetY, scale } = getViewport()
    return {
      x: (screen.x - offsetX) / scale,
      y: (screen.y - offsetY) / scale
    }
  }

  const getResizeHandle = (screenPos, el, scale, offsetX, offsetY) => {

    const handleSize = 15
    const padding = 10

    let minX, minY, w, h

    if (el.type === 'circle') {
      minX = (el.x - el.radius) * scale + offsetX
      minY = (el.y - el.radius) * scale + offsetY
      w = el.radius * 2 * scale
      h = el.radius * 2 * scale
    } else if (el.type === 'triangle') {
      const xs = el.points.map(p => p.x * scale + offsetX)
      const ys = el.points.map(p => p.y * scale + offsetY)
      minX = Math.min(...xs)
      minY = Math.min(...ys)
      w = Math.max(...xs) - minX
      h = Math.max(...ys) - minY
    } else {
      minX = el.x * scale + offsetX
      minY = el.y * scale + offsetY
      w = (el.width || 0) * scale
      h = (el.height || 0) * scale
    }

    const corners = {
      tl: { x: minX - padding, y: minY - padding },
      tr: { x: minX + w + padding, y: minY - padding },
      bl: { x: minX - padding, y: minY + h + padding },
      br: { x: minX + w + padding, y: minY + h + padding }
    }

    for (const [key, corner] of Object.entries(corners)) {
      const dx = screenPos.x - corner.x
      const dy = screenPos.y - corner.y
      if (Math.sqrt(dx * dx + dy * dy) < handleSize) {
        return key
      }
    }
    return null
  }

  const updateCursor = (canvasEl, screenPos, scale, offsetX, offsetY) => {
    if (!canvasEl) return

    if (isResizing) {
      canvasEl.style.cursor = "url('/hand.svg') 8 8, grabbing"
      return
    }

    if (isDragging) {
      canvasEl.style.cursor = "url('/hand.svg') 8 8, grabbing"
      return
    }

    if (isPanning) {
      canvasEl.style.cursor = "url('/hand.svg') 8 8, grabbing"
      return
    }

    if (isMarqueeSelecting) {
      canvasEl.style.cursor = 'crosshair'
      return
    }

    if (store.selectedIds.length === 1) {
      const selectedEl = store.elements.find(el => el.id === store.selectedIds[0])
      if (selectedEl) {
        const handle = getResizeHandle(screenPos, selectedEl, scale, offsetX, offsetY)
        if (handle) {
          canvasEl.style.cursor = "url('/hand.svg') 8 8, grab"
          return
        }
      }
    }

    canvasEl.style.cursor = 'default'
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

    const screenPos = getScreenCoords(e, canvasEl)
    const worldPos = getWorldCoords(e, canvasEl)
    const now = Date.now()
    const { scale, offsetX, offsetY } = getViewport()

    // 优先检测手柄（用已选中的元素）
    // 优先检测手柄（单选或多选）
    if (store.selectedIds.length >= 1) {
      const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))

      if (selectedElements.length > 1) {
        // 多选：计算包围盒
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

        const padding = 8
        const corners = {
          tl: { x: minX - padding, y: minY - padding },
          tr: { x: maxX + padding, y: minY - padding },
          bl: { x: minX - padding, y: maxY + padding },
          br: { x: maxX + padding, y: maxY + padding }
        }

        let detectedHandle = null
        for (const [key, corner] of Object.entries(corners)) {
          const screenCorner = {
            x: corner.x * scale + offsetX,
            y: corner.y * scale + offsetY
          }
          const dx = screenPos.x - screenCorner.x
          const dy = screenPos.y - screenCorner.y
          if (Math.sqrt(dx * dx + dy * dy) < 15) {
            detectedHandle = key
            break
          }
        }

        if (detectedHandle) {
          isResizing = true
          resizeHandle = detectedHandle
          resizeStartPos = worldPos
          resizeStartSize = { elements: JSON.parse(JSON.stringify(selectedElements)) }
          isDragging = false
          isPanning = false
          canvasEl.style.cursor = 'nwse-resize'
          return
        }
      } else {
        // 单选：原有手柄检测逻辑
        const selectedEl = selectedElements[0]
        if (selectedEl) {
          const handle = getResizeHandle(screenPos, selectedEl, scale, offsetX, offsetY)
          if (handle) {
            isResizing = true
            resizeHandle = handle
            resizeStartPos = worldPos

            if (selectedEl.type === 'circle') {
              resizeStartSize = { radius: selectedEl.radius, x: selectedEl.x, y: selectedEl.y }
            } else if (selectedEl.type === 'triangle') {
              resizeStartSize = { points: JSON.parse(JSON.stringify(selectedEl.points)) }
            } else {
              resizeStartSize = {
                x: selectedEl.x,
                y: selectedEl.y,
                width: selectedEl.width,
                height: selectedEl.height
              }
            }
            isDragging = false
            isPanning = false
            canvasEl.style.cursor = 'nwse-resize'
            return
          }
        }
      }
    }

    // 找点击的元素
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

      lastMousePos = { x: screenPos.x, y: screenPos.y }
      isPanning = false
      isMarqueeSelecting = false

    } else {
      if (isSpacePressed) {
        clearSelection()
        isPanning = true
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
    if (canvasEl) canvasEl.style.cursor = 'default'
  }

  const handleMouseMove = (e, canvasEl) => {
    const screenPos = getScreenCoords(e, canvasEl)
    const { scale, offsetX, offsetY } = getViewport()

    updateCursor(canvasEl, screenPos, scale, offsetX, offsetY)

    if (isResizing) {
      const worldPos = getWorldCoords(e, canvasEl)
      const dx = worldPos.x - resizeStartPos.x
      const dy = worldPos.y - resizeStartPos.y

      // 获取所有选中的元素
      const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))
      if (selectedElements.length === 0) return

      // ========== 多选缩放 ==========
      if (selectedElements.length > 1) {
        // 计算包围盒中心
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

        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2

        // 计算缩放比例
        const startDist = Math.sqrt(Math.pow(resizeStartPos.x - cx, 2) + Math.pow(resizeStartPos.y - cy, 2))
        const currentDist = Math.max(10, startDist + (dx + dy) / 2)
        const scaleFactor = Math.max(0.3, Math.min(3, currentDist / startDist))

        // 缩放所有选中元素
        selectedElements.forEach(el => {
          if (el.type === 'circle') {
            const newRadius = Math.max(5, el.radius * scaleFactor)
            const newX = cx + (el.x - cx) * scaleFactor
            const newY = cy + (el.y - cy) * scaleFactor
            updateElement(el.id, { radius: newRadius, x: newX, y: newY })
          } else if (el.type === 'triangle') {
            const newPoints = el.points.map(p => ({
              x: cx + (p.x - cx) * scaleFactor,
              y: cy + (p.y - cy) * scaleFactor
            }))
            updateElement(el.id, { points: newPoints })
          } else {
            const newWidth = Math.max(10, (el.width || 0) * scaleFactor)
            const newHeight = Math.max(10, (el.height || 0) * scaleFactor)
            const newX = cx + (el.x - cx) * scaleFactor
            const newY = cy + (el.y - cy) * scaleFactor
            updateElement(el.id, { width: newWidth, height: newHeight, x: newX, y: newY })
          }
        })
        return
      }

      // ========== 单选缩放（原有逻辑，完全不动） ==========
      const element = selectedElements[0]

      if (element.type === 'circle') {
        const scaleFactor = 1 + (dx + dy) / (element.radius * 2)
        const newRadius = Math.max(10, (resizeStartSize.radius || element.radius) * scaleFactor)
        updateElement(element.id, { radius: newRadius })
      } else if (element.type === 'triangle') {
        const points = resizeStartSize.points || element.points

        if (resizeHandle === 'br') {
          const cx = (points[0].x + points[1].x + points[2].x) / 3
          const cy = (points[0].y + points[1].y + points[2].y) / 3
          const startDist = Math.sqrt(Math.pow(points[0].x - cx, 2) + Math.pow(points[0].y - cy, 2))
          const currentDist = Math.max(10, startDist + (dx + dy) / 2)
          const scaleFactor = Math.max(0.3, Math.min(3, currentDist / startDist))

          updateElement(element.id, {
            points: points.map(p => ({
              x: cx + (p.x - cx) * scaleFactor,
              y: cy + (p.y - cy) * scaleFactor
            }))
          })
        } else {
          const newPoints = [...points]
          const index = { tl: 0, tr: 1, bl: 2 }[resizeHandle]
          if (index !== undefined) {
            newPoints[index] = { x: points[index].x + dx, y: points[index].y + dy }
            updateElement(element.id, { points: newPoints })
          }
        }
      } else {
        let newWidth = resizeStartSize.width
        let newHeight = resizeStartSize.height
        let newX = resizeStartSize.x
        let newY = resizeStartSize.y

        if (resizeHandle?.includes('r')) newWidth = Math.max(20, resizeStartSize.width + dx)
        if (resizeHandle?.includes('l')) {
          newWidth = Math.max(20, resizeStartSize.width - dx)
          newX = resizeStartSize.x + dx
        }
        if (resizeHandle?.includes('b')) newHeight = Math.max(20, resizeStartSize.height + dy)
        if (resizeHandle?.includes('t')) {
          newHeight = Math.max(20, resizeStartSize.height - dy)
          newY = resizeStartSize.y + dy
        }

        updateElement(element.id, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY
        })
      }
      return
    }

    // ========== 以下代码完全不动 ==========
    if (isMarqueeSelecting) {
      const worldPos = getWorldCoords(e, canvasEl)
      marqueeEnd = worldPos
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

    const dx = screenPos.x - lastMousePos.x
    const dy = screenPos.y - lastMousePos.y

    if (isDragging) {
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
            updateElement(id, {
              x: el.x + worldDx,
              y: el.y + worldDy
            })
          }
        }
      })
    } else if (isPanning) {
      panViewport(dx, dy)
    }

    lastMousePos = { x: screenPos.x, y: screenPos.y }
  }

  const handleMouseUp = (e, canvasEl) => {
    if (isResizing) {
      const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))

      selectedElements.forEach(el => {
        if (el.type === 'circle') {
          updateElement(el.id, {
            radius: Math.round(el.radius),
            x: Math.round(el.x),
            y: Math.round(el.y)
          })
        } else if (el.type === 'triangle') {
          const roundedPoints = el.points.map(p => ({
            x: Math.round(p.x),
            y: Math.round(p.y)
          }))
          updateElement(el.id, { points: roundedPoints })
        } else {
          updateElement(el.id, {
            x: Math.round(el.x),
            y: Math.round(el.y),
            width: Math.round(el.width),
            height: Math.round(el.height)
          })
        }
      })

      isResizing = false
      resizeHandle = null
      record()
    }

    if (isDragging) {
      store.selectedIds.forEach(id => {
        const el = store.elements.find(e => e.id === id)
        if (el) {
          if (el.type === 'triangle') {
            const roundedPoints = el.points.map(p => ({
              x: Math.round(p.x),
              y: Math.round(p.y)
            }))
            updateElement(id, { points: roundedPoints })
          } else {
            updateElement(id, {
              x: Math.round(el.x),
              y: Math.round(el.y)
            })
          }
        }
      })
      record()
    }

    if (isMarqueeSelecting) {
      isMarqueeSelecting = false
      marqueeStart = null
      marqueeEnd = null
      store.marqueeRect = null
    }

    isDragging = false
    isPanning = false
    if (canvasEl) canvasEl.style.cursor = 'default'
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