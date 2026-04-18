/**
   * 坐标转换（getScreenCoords, getWorldCoords）
   * 手柄检测（getResizeHandle, getRotateHandle）
   * 光标更新（updateCursor）
   * 键盘事件（handleKeyDown, handleKeyUp）
   * 鼠标事件（handleMouseDown, handleMouseMove, handleMouseUp）
   * 单选缩放（handleCircleResize, handleTriangleResize, handleRectResize）
   * 多选缩放（handleMultiResize）
   * 滚轮事件（handleWheel）
   * 生命周期（onMounted, onUnmounted）
   */

import { useCanvasStore } from '../store/canvasStore'
import { isPointInElement } from '../utils/math'
import { useElements } from './useElements'
import { useViewport } from './useViewport'
import { useHistory } from './useHistory'
import { useText } from './useText'
import { onMounted, onUnmounted } from 'vue'
import { getMultiSelectionCenter, getDistance, getScaleFactor, getElementCenter } from '../utils/math'
import { getElementBounds, rotatePoint } from '../utils/Geometry'

let globalLastClickTime = 0
let globalLastSelectedId = null

/**
 * 核心逻辑：获取有效选中元素列表 (Effective Selection)
 * * 作用：处理组合 (Group) 的联动关系。
 * 当用户点击或框选了某个属于“组合”的子元素时，该逻辑会自动将该组合内的所有兄弟元素
 * 全部加入选中状态，从而实现“点一选全”的交互体验。
 * * @param {Array} elements - 画布上所有的元素数组
 * @param {Array} selectedIds - 当前直接选中的原始 ID 数组（来自点击或框选）
 * @returns {Array} 包含组合关联后的完整 ID 数组
 */
const getEffectiveSelectedIds = (elements, selectedIds) => {
  const ids = new Set(selectedIds)

  //遍历每一个被直接选中的 ID
  selectedIds.forEach(id => {
    // 查找对应的实体
    const el = elements.find(e => e.id === id)

    //【关键判定】检查该元素是否被打过组 (groupId)
    if (el && el.groupId) {
      elements.forEach(other => {
        if (other.groupId === el.groupId) {
          ids.add(other.id)
        }
      })
    }
  })
  return [...ids]
}

export function useInteraction() {
  const store = useCanvasStore()
  const { updateElement, setSelection, clearSelection, toggleSelection } = useElements()
  const { getViewport, panViewport, zoomIn, zoomOut } = useViewport()
  const { record } = useHistory()
  const { startEditing, editingId } = useText()

  /**
   * 交互状态标志
   * 用于跟踪当前用户操作的类型和阶段
   */
  let isDragging = false           // 元素拖拽移动中
  let isPanning = false            // 画布平移中（空格键 + 拖拽）
  let lastMousePos = { x: 0, y: 0 } // 上一帧鼠标位置，用于计算增量
  let isMarqueeSelecting = false   // 框选中
  let marqueeStart = null          // 框选起点（世界坐标）
  let marqueeEnd = null            // 框选终点（世界坐标）
  let isSpacePressed = false       // 空格键是否按下

  /**
   * 缩放状态
   * 用于跟踪元素缩放操作的状态
   */
  let isResizing = false           // 缩放进行中
  let resizeHandle = null          // 当前拖拽的手柄，值为 'tl', 'tr', 'bl', 'br' 之一
  let resizeStartPos = { x: 0, y: 0 }  // 缩放开始时的鼠标位置（世界坐标）
  let resizeStartSize = {          // 缩放开始时的元素尺寸和位置
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    points: null,                  // 三角形专用：三个顶点坐标
    radius: null                   // 圆形专用：半径
  }

  /**
   * 旋转状态
   * 用于跟踪元素旋转操作的状态
   */
  let isRotating = false           // 旋转进行中
  let rotateStartAngle = 0         // 旋转开始时的鼠标角度（弧度）
  let rotateStartRotation = 0      // 单选时：旋转开始时的元素角度
  let rotateStartRotations = []    // 多选时：旋转开始时各元素的初始角度，结构为 [{ id, rotation }]

  //将鼠标事件坐标转换为相对于画布元素的屏幕坐标
  const getScreenCoords = (e, canvasEl) => {
    const rect = canvasEl.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  //将鼠标事件坐标转换为世界坐标
  const getWorldCoords = (e, canvasEl) => {
    const screen = getScreenCoords(e, canvasEl)
    const { offsetX, offsetY, scale } = getViewport()
    return {
      x: (screen.x - offsetX) / scale,
      y: (screen.y - offsetY) / scale
    }
  }

  /**
 * 检测鼠标是否悬停在元素的缩放手柄上
 * 支持矩形、圆形、三角形，并正确处理元素旋转
 * @param {{x: number, y: number}} screenPos - 鼠标的屏幕坐标
 * @param {Object} el - 目标元素
 * @param {number} scale - 当前视口缩放比例
 * @param {number} offsetX - 视口 X 偏移
 * @param {number} offsetY - 视口 Y 偏移
 * @returns {string|null} 手柄标识：'tl'（左上）、'tr'（右上）、'bl'（左下）、'br'（右下），未命中返回 null
 */
  const getResizeHandle = (screenPos, el, scale, offsetX, offsetY) => {
    const handleSize = 15
    const padding = 8 / scale

    const bounds = getElementBounds(el)
    const { minX, minY, width: w, height: h, centerX, centerY } = bounds
    const center = { x: centerX, y: centerY }


    // 四角相对于中心的偏移（世界坐标）
    const cornerOffsets = [
      { x: -w / 2 - padding, y: -h / 2 - padding },  // 左上
      { x: w / 2 + padding, y: -h / 2 - padding },  // 右上
      { x: -w / 2 - padding, y: h / 2 + padding },  // 左下
      { x: w / 2 + padding, y: h / 2 + padding }   // 右下
    ]

    // 计算旋转后的手柄屏幕坐标
    const corners = cornerOffsets.map(offset => {
      const point = { x: center.x + offset.x, y: center.y + offset.y }
      const rotated = el.rotation ? rotatePoint(point, center, el.rotation) : point
      return {
        x: rotated.x * scale + offsetX,
        y: rotated.y * scale + offsetY
      }
    })

    // 检测鼠标是否在某个手柄的范围内
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

  /**
 * 检测鼠标是否悬停在元素的旋转手柄上
 * @param {{x: number, y: number}} screenPos - 鼠标的屏幕坐标
 * @param {Object} el - 目标元素
 * @param {number} scale - 当前视口缩放比例
 * @param {number} offsetX - 视口 X 偏移
 * @param {number} offsetY - 视口 Y 偏移
 * @returns {boolean} 是否命中旋转手柄
 */
  const getRotateHandle = (screenPos, el, scale, offsetX, offsetY) => {
    const bounds = getElementBounds(el)
    const { minX, minY, width: w, height: h, centerX, centerY } = bounds
    const center = { x: centerX, y: centerY }

    const padding = 8 / scale
    const rotateHandleDistance = 28 / scale

    // 旋转手柄位于元素顶部中点上方
    const handlePoint = { x: center.x, y: minY - padding - rotateHandleDistance }
    const rotated = el.rotation ? rotatePoint(handlePoint, center, el.rotation) : handlePoint

    const screenHandle = {
      x: rotated.x * scale + offsetX,
      y: rotated.y * scale + offsetY
    }

    const dx = screenPos.x - screenHandle.x
    const dy = screenPos.y - screenHandle.y
    return Math.sqrt(dx * dx + dy * dy) < 20
  }

  //根据当前交互状态更新画布光标样式
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

  
   //键盘按下事件处理，空格键按下时启用画布平移模式
  const handleKeyDown = (e) => {
    if (e.code === 'Space' && !editingId.value) {
      isSpacePressed = true
      e.preventDefault()
    }
  }
  //键盘抬起事件处理，空格键抬起时禁用画布平移模式
  const handleKeyUp = (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false
    }
  }

  /**
 * 鼠标按下事件处理
 * 处理手柄检测、元素选中、拖拽开始、框选开始
 * @param {MouseEvent} e - 鼠标事件
 * @param {HTMLCanvasElement} canvasEl - 画布元素
 */
  const handleMouseDown = (e, canvasEl) => {
    if (editingId.value) return

    const screenPos = getScreenCoords(e, canvasEl)
    const worldPos = getWorldCoords(e, canvasEl)
    const now = Date.now()
    const { scale, offsetX, offsetY } = getViewport()

    /*
  * 第一阶段：手柄检测
  * 优先检测旋转手柄和缩放手柄，命中后直接返回
  */
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
      const padding = 8 / scale  
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
    
    /*
   * 第二阶段：元素点击检测
   * 优先检查点击是否在已选中元素的包围盒内（用于拖拽移动）
   */
    let clickedEl = null

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

  /**
 * 鼠标移动事件处理
 * 根据当前交互状态执行相应操作：缩放、旋转、框选、拖拽、平移
 */
  const handleMouseMove = (e, canvasEl) => {
    if (!canvasEl) return
    const screenPos = getScreenCoords(e, canvasEl)
    const { scale, offsetX, offsetY } = getViewport()

    updateCursor(canvasEl, screenPos, scale, offsetX, offsetY)

    // 框选
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

    // 旋转
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

    // 框选进行中，更新框选矩形，并动态计算框内的元素
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

        // 自动包含同组合的其他元素
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

    // 拖拽
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

  /**
 * 鼠标释放事件处理
 * 结束当前交互状态，保存历史记录，重置光标
 */
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
      //拖拽结束时也要获取包含组合在内的有效 ID
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

  /**
 * 圆形缩放处理
 * 根据鼠标当前位置与圆心的距离，等比例缩放半径
 * @param {Object} element - 目标圆形元素
 * @param {{x: number, y: number}} worldPos - 当前鼠标的世界坐标
 * @param {Object} resizeStartSize - 缩放开始时的初始状态，包含 radius 字段
 */
  const handleCircleResize = (element, worldPos, resizeStartSize) => {
    const startDist = resizeStartSize.radius || element.radius
    const currentDist = getDistance(worldPos, { x: element.x, y: element.y })
    const scaleFactor = currentDist / startDist
    updateElement(element.id, { radius:startDist * scaleFactor })
  }

  /**
   * 三角形缩放处理
   * 支持两种模式：
   * - 拖拽右下角手柄（'br'）：以三角形中心为基准等比例缩放
   * - 拖拽其他顶点手柄：直接移动对应顶点的位置
   * @param {Object} element - 目标三角形元素
   * @param {{x: number, y: number}} worldPos - 当前鼠标的世界坐标
   * @param {number} dx - 鼠标在 X 方向的移动增量
   * @param {number} dy - 鼠标在 Y 方向的移动增量
   * @param {string} resizeHandle - 当前拖拽的手柄标识（'tl', 'tr', 'bl', 'br'）
   * @param {Object} resizeStartSize - 缩放开始时的初始状态，包含 points 字段
   */
  const handleTriangleResize = (element, worldPos, dx, dy, resizeHandle, resizeStartSize) => {
    const points = resizeStartSize.points || element.points

    if (resizeHandle === 'br') {
      // 等比例缩放：以三角形中心为基准点
      const cx = (points[0].x + points[1].x + points[2].x) / 3
      const cy = (points[0].y + points[1].y + points[2].y) / 3
      const startDist = getDistance(points[0], { x: cx, y: cy })
      const currentDist = getDistance(worldPos, { x: cx, y: cy })
      const scaleFactor = currentDist / startDist

      updateElement(element.id, {
        points: points.map(p => ({
          x: cx + (p.x - cx) * scaleFactor,
          y: cy + (p.y - cy) * scaleFactor
        }))
      })
    } else {
      // 单顶点拖拽：直接修改对应顶点的坐标
      const newPoints = [...points]
      const index = { tl: 0, tr: 1, bl: 2 }[resizeHandle]
      if (index !== undefined) {
        newPoints[index] = { x: points[index].x + dx, y: points[index].y + dy }
        updateElement(element.id, { points: newPoints })
      }
    }
  }

  /**
 * 矩形缩放处理
 * 根据拖拽的手柄位置，更新矩形的宽度、高度以及左上角坐标
 * 手柄标识规则：
 * - 'l' 表示左侧手柄，修改宽度和 X 坐标
 * - 'r' 表示右侧手柄，仅修改宽度
 * - 't' 表示顶部手柄，修改高度和 Y 坐标
 * - 'b' 表示底部手柄，仅修改高度
 * @param {Object} element - 目标矩形元素
 * @param {number} dx - 鼠标在 X 方向的移动增量
 * @param {number} dy - 鼠标在 Y 方向的移动增量
 * @param {string} resizeHandle - 当前拖拽的手柄标识
 * @param {Object} resizeStartSize - 缩放开始时的初始尺寸和位置
 */
  const handleRectResize = (element, dx, dy, resizeHandle, resizeStartSize) => {
    let newWidth = resizeStartSize.width
    let newHeight = resizeStartSize.height
    let newX = resizeStartSize.x
    let newY = resizeStartSize.y

    if (resizeHandle?.includes('r')) newWidth = resizeStartSize.width + dx
    if (resizeHandle?.includes('l')) {
      newWidth = resizeStartSize.width - dx
      newX = resizeStartSize.x + dx
    }
    if (resizeHandle?.includes('b')) newHeight = resizeStartSize.height + dy
    if (resizeHandle?.includes('t')) {
      newHeight = resizeStartSize.height - dy
      newY = resizeStartSize.y + dy
    }

    updateElement(element.id, {
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY
    })
  }
  
  /**
   * 多元素缩放处理
   * 根据鼠标当前位置与多选中心的距离，等比例缩放选中元素
   * @param {{x: number, y: number}} worldPos - 当前鼠标的世界坐标
   * @param {Array} selectedElements - 选中的元素数组
   * @param {{x: number, y: number}} resizeStartPos - 缩放开始时的鼠标位置
   * @param {Object} resizeStartSize - 缩放开始时的初始尺寸和位置
   */
  const handleMultiResize = (worldPos, selectedElements, resizeStartPos, resizeStartSize) => {
    const { cx, cy } = getMultiSelectionCenter(selectedElements)

    const startDist = getDistance(resizeStartPos, { x: cx, y: cy })// 与多选中心的距离
    const currentDist = getDistance(worldPos, { x: cx, y: cy })// 与当前鼠标的距离
    const scaleFactor = currentDist / startDist// 缩放比

    const startElements = resizeStartSize.elements
    selectedElements.forEach(el => {
      const startEl = startElements.find(e => e.id === el.id)
      if (!startEl) return

      // 根据元素类型进行不同处理
      if (el.type === 'circle') {
        updateElement(el.id, {
          radius: startEl.radius * scaleFactor,  
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
          width: startEl.width * scaleFactor,
          height: startEl.height * scaleFactor,
          x: cx + (startEl.x - cx) * scaleFactor,
          y: cy + (startEl.y - cy) * scaleFactor
        })
      }
    })
  }

  // 鼠标滚轮
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