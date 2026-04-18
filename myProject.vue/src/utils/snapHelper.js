// src/utils/snapHelper.js
import { getElementBounds } from './Geometry'

const SNAP_THRESHOLD = 5

export function calculateSnap(currentElement, allElements, selectedIds, scale) {
  const threshold = SNAP_THRESHOLD / scale
  const lines = []
  let snapDx = 0
  let snapDy = 0

  const currentBounds = getElementBounds(currentElement)
  const current = {
    left: currentBounds.minX,
    right: currentBounds.maxX,
    top: currentBounds.minY,
    bottom: currentBounds.maxY,
    centerX: currentBounds.centerX,
    centerY: currentBounds.centerY
  }

  const targetElements = allElements.filter(el =>
    !selectedIds.includes(el.id) && el.isVisible !== false && !el.isLocked
  )

  const snappedX = new Set()
  const snappedY = new Set()

  targetElements.forEach(targetEl => {
    const targetBounds = getElementBounds(targetEl)
    const targetMetrics = {
      left: targetBounds.minX,
      right: targetBounds.maxX,
      top: targetBounds.minY,
      bottom: targetBounds.maxY,
      centerX: targetBounds.centerX,
      centerY: targetBounds.centerY
    }

    // 垂直方向检测
    const verticalMatches = [
      { current: current.left, target: targetMetrics.left, type: 'left' },
      { current: current.right, target: targetMetrics.right, type: 'right' },
      { current: current.centerX, target: targetMetrics.centerX, type: 'center' }
    ]

    verticalMatches.forEach(({ current: cur, target: tgt, type }) => {
      const diff = Math.abs(cur - tgt)
      if (diff < threshold && !snappedX.has(type)) {
        lines.push({
          type: 'vertical',
          position: tgt,
          source: type,
          targetElementId: targetEl.id
        })
        snapDx = tgt - cur
        snappedX.add(type)
      }
    })

    // 水平方向检测
    const horizontalMatches = [
      { current: current.top, target: targetMetrics.top, type: 'top' },
      { current: current.bottom, target: targetMetrics.bottom, type: 'bottom' },
      { current: current.centerY, target: targetMetrics.centerY, type: 'middle' }
    ]

    horizontalMatches.forEach(({ current: cur, target: tgt, type }) => {
      const diff = Math.abs(cur - tgt)
      if (diff < threshold && !snappedY.has(type)) {
        lines.push({
          type: 'horizontal',
          position: tgt,
          source: type,
          targetElementId: targetEl.id
        })
        snapDy = tgt - cur
        snappedY.add(type)
      }
    })
  })

  return {
    lines,
    snapOffset: { dx: snapDx, dy: snapDy }
  }
}