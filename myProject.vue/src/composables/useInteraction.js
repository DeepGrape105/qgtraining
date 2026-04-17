import { useCanvasStore } from '../store/canvasStore'
import { isPointInElement } from '../utils/math'
import { useElements } from './useElements'
import { useViewport } from './useViewport'
import { useHistory } from './useHistory'
import { useText } from './useText'
import { onMounted, onUnmounted } from 'vue'
import { getMultiSelectionCenter, getDistance, getScaleFactor, getElementCenter } from '../utils/math'

let globalLastClickTime = 0
let globalLastSelectedId = null

// 🌟 获取有效选中元素（如果选中了组合内的元素，自动包含同组合的其他元素）
const getEffectiveSelectedIds = (elements, selectedIds) => {
  const ids = new Set(selectedIds)

  selectedIds.forEach(id => {
    const el = elements.find(e => e.id === id)
    if (el && el.groupId) {
      // 🌟 有 groupId：把同组合的所有元素都加进来
      elements.forEach(other => {
        if (other.groupId === el.groupId) {
          ids.add(other.id)
        }
      })
    }
    // 🌟 没有 groupId：什么都不做，只操作它自己
  })

  return [...ids]
}
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

  //旋转状态
  let isRotating = false
  let rotateStartAngle = 0
  let rotateStartRotation = 0
  let rotateStartRotations = []

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
    const padding = 8 / scale

    let minX, minY, w, h, centerX, centerY

    if (el.type === 'circle') {
      centerX = el.x
      centerY = el.y
      minX = el.x - el.radius
      minY = el.y - el.radius
      w = el.radius * 2
      h = el.radius * 2
    } else if (el.type === 'triangle') {
      const xs = el.points.map(p => p.x)
      const ys = el.points.map(p => p.y)
      minX = Math.min(...xs)
      minY = Math.min(...ys)
      w = Math.max(...xs) - minX
      h = Math.max(...ys) - minY
      centerX = minX + w / 2
      centerY = minY + h / 2
    } else {
      minX = el.x
      minY = el.y
      w = el.width || 0
      h = el.height || 0
      centerX = minX + w / 2
      centerY = minY + h / 2
    }

    // 🌟 四角相对于中心的偏移（世界坐标）
    const cornerOffsets = [
      { x: -w / 2 - padding, y: -h / 2 - padding },  // 左上
      { x: w / 2 + padding, y: -h / 2 - padding },  // 右上
      { x: -w / 2 - padding, y: h / 2 + padding },  // 左下
      { x: w / 2 + padding, y: h / 2 + padding }   // 右下
    ]

    const corners = cornerOffsets.map(offset => {
      let x = offset.x
      let y = offset.y

      // 🌟 如果有旋转，计算旋转后的偏移
      if (el.rotation) {
        const rad = (el.rotation * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        x = offset.x * cos - offset.y * sin
        y = offset.x * sin + offset.y * cos
      }

      return {
        x: (centerX + x) * scale + offsetX,
        y: (centerY + y) * scale + offsetY
      }
    })

    const keys = ['tl', 'tr', 'bl', 'br']
    for (let i = 0; i < corners.length; i++) {
      const dx = screenPos.x - corners[i].x
      const dy = screenPos.y - corners[i].y
      if (Math.sqrt(dx * dx + dy * dy) < handleSize) {
        return keys[i]
      }
    }
    return null
  }

  const getRotateHandle = (screenPos, el, scale, offsetX, offsetY) => {
    // 计算包围盒（和 drawHighlight 一样）
    let minX, minY, w, h
    if (el.type === 'triangle') {
      const xs = el.points.map(p => p.x)
      const ys = el.points.map(p => p.y)
      minX = Math.min(...xs)
      minY = Math.min(...ys)
      w = Math.max(...xs) - minX
      h = Math.max(...ys) - minY
    } else if (el.type === 'circle') {
      minX = el.x - el.radius
      minY = el.y - el.radius
      w = el.radius * 2
      h = el.radius * 2
    } else if (el.type === 'text') {
      minX = el.x
      minY = el.y
      w = el.width || 100
      h = el.height || 20
    } else {
      minX = el.x
      minY = el.y
      w = el.width
      h = el.height
    }

    const center = {
      x: minX + w / 2,
      y: minY + h / 2
    }

    const padding = 8 / scale
    const rotateHandleDistance = 28 / scale
    const handleY = minY - padding - rotateHandleDistance
    const handleX = center.x

    // 如果有旋转，计算旋转后的位置
    let worldX = handleX
    let worldY = handleY
    if (el.rotation) {
      const rad = (el.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const dx = handleX - center.x
      const dy = handleY - center.y
      worldX = center.x + dx * cos - dy * sin
      worldY = center.y + dx * sin + dy * cos
    }

    const screenHandle = {
      x: worldX * scale + offsetX,
      y: worldY * scale + offsetY
    }

    const dx = screenPos.x - screenHandle.x
    const dy = screenPos.y - screenHandle.y
    if (Math.sqrt(dx * dx + dy * dy) < 20) {
      return true
    }
    return false
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

    // ========== 手柄检测（单选和多选） ==========
    // ========== 手柄检测（单选和多选） ==========
    if (store.selectedIds.length >= 1) {
      const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))

      // 计算包围盒（用于多选和旋转中心）
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

      const center = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 }
      const padding = 8 / scale   // 和绘制保持一致
      const w = maxX - minX
      const h = maxY - minY

      // --- 1. 旋转手柄检测 ---
      let rotateDetected = false
      if (store.selectedIds.length === 1) {
        // 单选：用专门的检测函数（已处理旋转）
        rotateDetected = getRotateHandle(screenPos, selectedElements[0], scale, offsetX, offsetY)
      } else {
        // 多选：暂时用原来的逻辑
        const rotateHandle = {
          x: center.x,
          y: minY - padding - 28 / scale
        }
        const screenRotate = {
          x: rotateHandle.x * scale + offsetX,
          y: rotateHandle.y * scale + offsetY
        }
        const rotDx = screenPos.x - screenRotate.x
        const rotDy = screenPos.y - screenRotate.y
        if (Math.sqrt(rotDx * rotDx + rotDy * rotDy) < 20) {
          rotateDetected = true
        }
      }

      if (rotateDetected) {
        isRotating = true
        const effectiveIds = getEffectiveSelectedIds(store.elements, store.selectedIds)
        rotateStartRotations = effectiveIds.map(id => {
          const el = store.elements.find(e => e.id === id)
          return { id, rotation: el?.rotation || 0 }
        })
        rotateStartAngle = Math.atan2(screenPos.y - center.y * scale - offsetY, screenPos.x - center.x * scale - offsetX)
        canvasEl.style.cursor = 'grabbing'
        return
      }

      // --- 2. 缩放手柄检测 ---
      let detectedHandle = null
      if (store.selectedIds.length === 1) {
        // 单选：用专门的检测函数（已处理旋转）
        detectedHandle = getResizeHandle(screenPos, selectedElements[0], scale, offsetX, offsetY)
      } else {
        // 多选：用原来的包围盒四角
        const corners = {
          tl: { x: minX - padding, y: minY - padding },
          tr: { x: maxX + padding, y: minY - padding },
          bl: { x: minX - padding, y: maxY + padding },
          br: { x: maxX + padding, y: maxY + padding }
        }
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
      }

      if (detectedHandle) {
        isResizing = true
        resizeHandle = detectedHandle
        resizeStartPos = worldPos

        const effectiveIds = getEffectiveSelectedIds(store.elements, store.selectedIds)
        const effectiveElements = effectiveIds.map(id => store.elements.find(e => e.id === id)).filter(Boolean)

        if (effectiveElements.length === 1) {
          const el = effectiveElements[0]
          if (el.type === 'circle') {
            resizeStartSize = { radius: el.radius, x: el.x, y: el.y }
          } else if (el.type === 'triangle') {
            resizeStartSize = { points: JSON.parse(JSON.stringify(el.points)) }
          } else {
            resizeStartSize = { x: el.x, y: el.y, width: el.width, height: el.height }
          }
        } else {
          resizeStartSize = {
            elements: effectiveElements.map(el => ({
              id: el.id, type: el.type, x: el.x, y: el.y,
              radius: el.radius, width: el.width, height: el.height,
              points: el.points ? JSON.parse(JSON.stringify(el.points)) : null
            }))
          }
        }
        isDragging = false
        isPanning = false
        canvasEl.style.cursor = 'nwse-resize'
        return
      }
    }

    // ========== 点击元素检测 ==========

    
    // ========== 点击元素检测 ==========
    let clickedEl = null

    // 🌟 优先检查：点击位置是否在已选中元素的包围盒内（包括 padding 区域）
    if (store.selectedIds.length > 0) {
      const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))

      // 计算选中元素的总包围盒
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

      // 加上选中框的 padding（和绘制保持一致）
      const boxPadding = 8 / scale
      const expandedMinX = minX - boxPadding
      const expandedMinY = minY - boxPadding
      const expandedMaxX = maxX + boxPadding
      const expandedMaxY = maxY + boxPadding

      // 检查点击是否在扩展包围盒内
      if (worldPos.x >= expandedMinX && worldPos.x <= expandedMaxX &&
        worldPos.y >= expandedMinY && worldPos.y <= expandedMaxY) {
        // 在包围盒内，再检查是否真的点中了某个元素
        clickedEl = [...store.elements]
          .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
          .find(el => isPointInElement(worldPos.x, worldPos.y, el))

        // 即使没有点中具体元素，只要在包围盒内，就启动拖拽（不取消选中）
        if (!clickedEl) {
          // 在选中框内空白处点击，不取消选中，直接开启拖拽
          isDragging = true
          lastMousePos = { x: screenPos.x, y: screenPos.y }
          isPanning = false
          isMarqueeSelecting = false
          if (canvasEl) canvasEl.style.cursor = 'default'
          return
        }
      }
    }

    // 如果上面没有找到 clickedEl，继续正常检测
    if (!clickedEl) {
      clickedEl = [...store.elements]
        .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
        .find(el => isPointInElement(worldPos.x, worldPos.y, el))
    }

    if (clickedEl) {
      // 双击检测
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
        // 如果点击的元素尚未被选中，才重置选中状态
        if (!store.selectedIds.includes(clickedEl.id)) {
          if (clickedEl.groupId) {
            const groupElements = store.elements.filter(el => el.groupId === clickedEl.groupId)
            store.selectedIds = groupElements.map(el => el.id)
          } else {
            setSelection(clickedEl.id)
          }
        }
        // 只要点中了元素，就开启拖拽
        isDragging = true
      }

      lastMousePos = { x: screenPos.x, y: screenPos.y }
      isPanning = false
      isMarqueeSelecting = false
    } else {
      // 点击空白
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
    if (!canvasEl) return
    const screenPos = getScreenCoords(e, canvasEl)
    const { scale, offsetX, offsetY } = getViewport()

    updateCursor(canvasEl, screenPos, scale, offsetX, offsetY)

    if (isResizing) {
      const worldPos = getWorldCoords(e, canvasEl)
      const dx = worldPos.x - resizeStartPos.x
      const dy = worldPos.y - resizeStartPos.y

      const effectiveIds = getEffectiveSelectedIds(store.elements, store.selectedIds)  // 🌟
      const selectedElements = effectiveIds.map(id => store.elements.find(e => e.id === id)).filter(Boolean)
      if (selectedElements.length === 0) return

      if (selectedElements.length > 1) {
        handleMultiResize(worldPos, selectedElements, resizeStartPos, resizeStartSize)
      } else {
        const element = selectedElements[0]
        if (element.type === 'circle') {
          handleCircleResize(element, worldPos, resizeStartSize)
        } else if (element.type === 'triangle') {
          handleTriangleResize(element, worldPos, dx, dy, resizeHandle, resizeStartSize)
        } else {
          handleRectResize(element, dx, dy, resizeHandle, resizeStartSize)
        }
      }
      return
    }

    if (isRotating) {
      const effectiveIds = getEffectiveSelectedIds(store.elements, store.selectedIds)  // 🌟
      const selectedElements = effectiveIds.map(id => store.elements.find(e => e.id === id)).filter(Boolean)
      if (selectedElements.length === 0) return

      if (selectedElements.length === 1) {
        // 单选旋转
        const selectedEl = selectedElements[0]
        const center = getElementCenter(selectedEl)
        const worldCenter = {
          x: center.x * scale + offsetX,
          y: center.y * scale + offsetY
        }
        const currentAngle = Math.atan2(screenPos.y - worldCenter.y, screenPos.x - worldCenter.x)
        const deltaAngle = (currentAngle - rotateStartAngle) * 180 / Math.PI
        const startRotation = rotateStartRotations[0]?.rotation || 0
        selectedEl.rotation = Math.round((startRotation + deltaAngle) % 360)
      } else {
        // 🌟 多选旋转：每个元素绕自己的中心旋转相同的角度
        // 计算整体包围盒中心作为参考
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

        const worldCenter = {
          x: (minX + (maxX - minX) / 2) * scale + offsetX,
          y: (minY + (maxY - minY) / 2) * scale + offsetY
        }

        const currentAngle = Math.atan2(screenPos.y - worldCenter.y, screenPos.x - worldCenter.x)
        const deltaAngle = (currentAngle - rotateStartAngle) * 180 / Math.PI

        selectedElements.forEach(el => {
          const startRotation = rotateStartRotations.find(r => r.id === el.id)?.rotation || 0
          el.rotation = Math.round((startRotation + deltaAngle) % 360)
        })
      }

      store.elements = [...store.elements]
      return
    }

    // 框选
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
        // 找出框内的元素
        const selected = store.elements.filter(el => isElementInRect(el, rect))

        // 🌟 自动包含同组合的其他元素
        const ids = new Set()
        selected.forEach(el => {
          ids.add(el.id)
          if (el.groupId) {
            store.elements.forEach(other => {
              if (other.groupId === el.groupId) {
                ids.add(other.id)
              }
            })
          }
        })

        store.selectedIds = [...ids]
      })
      return
    }

    if (editingId.value) return

    const effectiveIds = getEffectiveSelectedIds(store.elements, store.selectedIds)
    const dx = screenPos.x - lastMousePos.x
    const dy = screenPos.y - lastMousePos.y

    if (isDragging) {
      const effectiveIds = getEffectiveSelectedIds(store.elements, store.selectedIds)
      const worldDx = dx / scale
      const worldDy = dy / scale

      effectiveIds.forEach(id => {
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

    if (isRotating) {
      isRotating = false
      record()
    }

    if (isDragging) {
      // 🌟 核心修复：拖拽结束时也要获取包含组合在内的有效 ID
      const effectiveIds = getEffectiveSelectedIds(store.elements, store.selectedIds)
      effectiveIds.forEach(id => {
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
  // ========== 单选缩放函数 ==========

  const handleCircleResize = (element, worldPos, resizeStartSize) => {
    const startDist = resizeStartSize.radius || element.radius
    const currentDist = getDistance(worldPos, { x: element.x, y: element.y })
    const scaleFactor = getScaleFactor(startDist, currentDist)
    updateElement(element.id, { radius: Math.max(10, startDist * scaleFactor) })
  }

  const handleTriangleResize = (element, worldPos, dx, dy, resizeHandle, resizeStartSize) => {
    const points = resizeStartSize.points || element.points

    if (resizeHandle === 'br') {
      const cx = (points[0].x + points[1].x + points[2].x) / 3
      const cy = (points[0].y + points[1].y + points[2].y) / 3
      const startDist = getDistance(points[0], { x: cx, y: cy })
      const currentDist = getDistance(worldPos, { x: cx, y: cy })
      const scaleFactor = getScaleFactor(startDist, currentDist)

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
  }

  const handleRectResize = (element, dx, dy, resizeHandle, resizeStartSize) => {
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

  const handleMultiResize = (worldPos, selectedElements, resizeStartPos, resizeStartSize) => {
    const { cx, cy } = getMultiSelectionCenter(selectedElements)

    const startDist = getDistance(resizeStartPos, { x: cx, y: cy })
    const currentDist = getDistance(worldPos, { x: cx, y: cy })
    const scaleFactor = getScaleFactor(startDist, currentDist, 0.5, 2)

    const startElements = resizeStartSize.elements
    selectedElements.forEach(el => {
      const startEl = startElements.find(e => e.id === el.id)
      if (!startEl) return

      if (el.type === 'circle') {
        updateElement(el.id, {
          radius: Math.max(5, startEl.radius * scaleFactor),
          x: cx + (startEl.x - cx) * scaleFactor,
          y: cy + (startEl.y - cy) * scaleFactor
        })
      } else if (el.type === 'triangle') {
        const points = startEl.points
        const tcx = (points[0].x + points[1].x + points[2].x) / 3
        const tcy = (points[0].y + points[1].y + points[2].y) / 3

        const scaledPoints = points.map(p => ({
          x: tcx + (p.x - tcx) * scaleFactor,
          y: tcy + (p.y - tcy) * scaleFactor
        }))

        const newTcx = cx + (tcx - cx) * scaleFactor
        const newTcy = cy + (tcy - cy) * scaleFactor
        const deltaX = newTcx - tcx
        const deltaY = newTcy - tcy

        updateElement(el.id, {
          points: scaledPoints.map(p => ({
            x: p.x + deltaX,
            y: p.y + deltaY
          }))
        })
      } else {
        updateElement(el.id, {
          width: Math.max(10, startEl.width * scaleFactor),
          height: Math.max(10, startEl.height * scaleFactor),
          x: cx + (startEl.x - cx) * scaleFactor,
          y: cy + (startEl.y - cy) * scaleFactor
        })
      }
    })
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