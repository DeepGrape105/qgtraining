// src/utils/selectionRenderer.js
import { getElementsBounds } from './Geometry'

/**
 * 绘制选中框 (Selection UI Renderer)
 * 职责：
 * 1. 动态边界包围：实时计算多个图元的并集包围盒并外扩 Padding。
 * 2. 缩放一致性处理：通过 scale 参数逆向补偿线宽和手柄尺寸，确保在任何缩放比例下，控制手柄在视觉上的大小保持一致。
 * 3. 交互锚点绘制：渲染缩放手柄（Resizers）与旋转手柄（Rotation Pivot）。
 * * @param {CanvasRenderingContext2D} ctx - Canvas 绘图上下文
 * @param {Array} elements - 当前选中的图元对象数组
 * @param {number} scale - 当前画布的视口缩放比例
 * @param {Object} options - UI 样式配置
 */
export function drawSelectionBox(ctx, elements, scale, options = {}) {
  const {
    boxColor = '#1890ff',      // 选中框主色
    handleColor = '#1890ff',   // 缩放手柄颜色
    rotateHandleColor = '#4CAF50', // 旋转手柄专用色
    dashed = true              // 边框是否使用虚线
  } = options

  // ========== 阶段 1：多图元并集包围盒计算 (AABB Merge) ==========
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  elements.forEach(el => {
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

  // 基础几何参数预设
  // padding 随缩放比例调整，确保在屏幕上始终看起来是 8 像素左右
  const padding = 8 / scale
  const w = maxX - minX
  const h = maxY - minY
  const center = { x: minX + w / 2, y: minY + h / 2 }

  // ========== 阶段 2：绘制外轮廓辅助框 (Main Boundary) ==========
  ctx.save()
  ctx.strokeStyle = boxColor
  ctx.lineWidth = 2.5 / scale // 补偿线宽

  if (dashed) {
    // 动态虚线比例，保证缩放时间距感一致
    ctx.setLineDash([5 / scale, 5 / scale])
  } else {
    ctx.setLineDash([])
  }

  // 描绘带有 Padding 缓冲区的矩形框
  ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2)

  // ========== 阶段 3：绘制四角形变手柄 (Resize Handles) ==========
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = handleColor
  const handleSize = 10 / scale

  const corners = [
    { x: minX - padding, y: minY - padding },         // 左上
    { x: minX + w + padding, y: minY - padding },      // 右上
    { x: minX - padding, y: minY + h + padding },      // 左下
    { x: minX + w + padding, y: minY + h + padding }   // 右下
  ]

  corners.forEach(corner => {
    ctx.beginPath()
    // 渲染高对比度的圆形手柄，方便用户拾取
    ctx.arc(corner.x, corner.y, handleSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })

  // ========== 阶段 4：绘制旋转控制柄 (Rotation Handle) ==========
  const rotateHandleDistance = 28 / scale // 手柄距离包围盒顶部的垂距
  const rotateHandle = {
    x: center.x,
    y: minY - padding - rotateHandleDistance
  }

  // 绘制连接中心点与旋转球的垂线
  ctx.beginPath()
  ctx.strokeStyle = rotateHandleColor
  ctx.lineWidth = 1.5 / scale
  ctx.moveTo(center.x, minY - padding)
  ctx.lineTo(rotateHandle.x, rotateHandle.y)
  ctx.stroke()

  // 绘制旋转控制球及其阴影效果（增强交互深度感）
  ctx.beginPath()
  ctx.fillStyle = rotateHandleColor
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
  ctx.shadowBlur = 4 / scale
  ctx.arc(rotateHandle.x, rotateHandle.y, handleSize / 1.5, 0, Math.PI * 2)
  ctx.fill()

  // 渲染高光小白点，提升交互 UI 的精致度
  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.fillStyle = '#ffffff'
  ctx.arc(rotateHandle.x - 2 / scale, rotateHandle.y - 2 / scale, handleSize / 6, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}