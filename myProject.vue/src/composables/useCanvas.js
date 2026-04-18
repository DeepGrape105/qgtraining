// src/composables/useCanvas.js
import { useCanvasStore } from '../store/canvasStore'
import Renderer from './Renderer'
import { drawSelectionBox } from '../utils/selectionRenderer'
import { getElementsBounds } from '../utils/Geometry'
import { drawSnapLines } from '../utils/snapRenderer'

/**
 * useCanvas Composable
 * 负责画布的生命周期管理、高清屏适配、无限网格绘制以及核心渲染循环 (Render Loop)
 */
export function useCanvas() {
  const store = useCanvasStore()
  let ctx = null
  let canvas = null
  let animationFrameId = null

  /**
   * 初始化画布：处理 DPR 适配及窗口缩放监听
   * @param {HTMLCanvasElement} canvasEl 
   */
  const initCanvas = (canvasEl) => {
    canvas = canvasEl
    ctx = canvas.getContext('2d')

    const resizeCanvas = () => {
      const container = canvas.parentElement
      const dpr = window.devicePixelRatio || 1

      // 获取容器的逻辑尺寸（CSS 像素）
      const width = container.clientWidth
      const height = container.clientHeight

      // 1. 设置画布的实际渲染像素（物理像素）
      // 防止在高分屏（如 Retina）上出现模糊现象
      canvas.width = width * dpr
      canvas.height = height * dpr

      // 2. 通过 CSS 将画布缩放回原来的逻辑尺寸
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'

      // 3. 【关键】全局缩放上下文
      // 调用 ctx.scale(dpr, dpr) 后，后续绘制指令只需使用逻辑坐标，底层会自动映射到物理像素
      ctx.scale(dpr, dpr)
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
  }

  /**
   * 绘制组合选中框（紫色样式）
   * 用于标识一组具有组合关系的元素
   */
  const drawGroupHighlight = (ctx, elements, scale) => {
    drawSelectionBox(ctx, elements, scale, {
      boxColor: '#9c27b0',
      handleColor: '#9c27b0',
      rotateHandleColor: '#9c27b0',
      dashed: false
    })
  }

  /**
   * 绘制多选选中框（蓝色样式）
   * 用于标识临时选中的多个独立元素
   */
  const drawMultiSelectHighlight = (ctx, elements, scale, isSameGroup) => {
    drawSelectionBox(ctx, elements, scale, {
      boxColor: isSameGroup ? '#1890ff' : '#1890ff',
      handleColor: isSameGroup ? '#9c27b0' : '#1890ff',
      rotateHandleColor: isSameGroup ? '#9c27b0' : '#1890ff',
      dashed: !isSameGroup
    })
  }

  /**
   * 绘制无限网格背景
   * 核心算法：根据当前的偏移(offset)和缩放(scale)，反向计算出当前视口对应的“世界坐标”范围，仅绘制可见区域内的线条
   */
  const drawInfiniteGrid = (ctx, offsetX, offsetY, scale, gridSize, width, height) => {
    ctx.save()
    // 应用相机变换：平移视口并缩放
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    ctx.strokeStyle = '#e5e7eb'  // 浅灰色网格线
    ctx.lineWidth = 0.8 / scale  // 线宽随缩放调整，保持视觉宽度恒定

    const step = 50  // 固定步长 50px（世界坐标单位）

    // 反查当前屏幕边缘在世界坐标系中的位置
    const worldLeft = -offsetX / scale
    const worldTop = -offsetY / scale
    const worldRight = worldLeft + width / scale
    const worldBottom = worldTop + height / scale

    // 计算起始绘制点，确保网格线条对齐
    const startX = Math.floor(worldLeft / step) * step
    const startY = Math.floor(worldTop / step) * step

    ctx.beginPath()

    // 绘制垂直线
    for (let x = startX; x <= worldRight; x += step) {
      ctx.moveTo(x, worldTop)
      ctx.lineTo(x, worldBottom)
    }

    // 绘制水平线
    for (let y = startY; y <= worldBottom; y += step) {
      ctx.moveTo(worldLeft, y)
      ctx.lineTo(worldRight, y)
    }

    ctx.stroke()
    ctx.restore()
  }

  /**
   * 核心渲染循环：驱动整个画布的重绘
   * 遵循顺序：清空 -> 背景 -> 网格 -> 元素渲染 -> 交互辅助线 -> 选中反馈
   */
  const renderLoop = () => {
    if (!ctx || !canvas) return

    const { backgroundColor, showGrid, gridSize } = store.canvasConfig
    const { offsetX, offsetY, scale } = store.viewport

    // 获取画布的 CSS 逻辑尺寸
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // 1. 清空画布
    // 由于 initCanvas 中执行了 scale(dpr)，清空时需暂时重置变换以精准按物理像素清除
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // 重置为单位矩阵
    ctx.clearRect(0, 0, canvas.width, canvas.height) // 按物理像素全量清除
    ctx.restore()

    // 2. 画背景色
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // 3. 画网格辅助线
    if (showGrid) {
      drawInfiniteGrid(ctx, offsetX, offsetY, scale, gridSize, width, height)
    }

    // 4. 画所有图形元素
    ctx.save()
    ctx.translate(offsetX, offsetY) // 应用平移
    ctx.scale(scale, scale)         // 应用缩放

    // 按 zIndex 升序排序，确保元素按正确的层级覆盖绘制
    const sortedElements = [...store.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const el of sortedElements) {
      // 仅绘制元素本体，不在此处绘制选中高亮
      Renderer.draw(ctx, el, { skipHighlight: true })
    }

    // 5. 画框选交互矩形 (Marquee Selection)
    if (store.marqueeRect) {
      const rect = store.marqueeRect
      ctx.strokeStyle = '#1890ff'
      ctx.lineWidth = 1.5 / scale
      ctx.setLineDash([5 / scale, 5 / scale]) // 虚线效果
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      ctx.fillStyle = 'rgba(24, 144, 255, 0.1)'
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
      ctx.setLineDash([])
    }

    // 6. 复杂的选中反馈系统
    // 目标：清晰区分“单个元素选中”、“临时多选”和“组合选中”
    const selectedElements = store.elements.filter(el => store.selectedIds.includes(el.id))

    // 提取选中元素中的组合 ID 信息
    const groupIds = [...new Set(selectedElements.map(el => el.groupId).filter(Boolean))]
    const nonGroupElements = selectedElements.filter(el => !el.groupId)

    // 情况1：单选
    if (selectedElements.length === 1) {
      const el = selectedElements[0]
      // 只有非组合元素才绘制基础高亮（组合高亮由下方逻辑统一处理）
      if (!el.groupId) {
        Renderer.drawHighlight(ctx, el, scale)
      }
    }

    // 情况2：多选
    else if (selectedElements.length > 1) {
      // 逻辑：判断当前选中的所有元素是否刚好由几个“完整组合”构成
      const allGroupElementsComplete = groupIds.every(groupId => {
        const groupElements = store.elements.filter(el => el.groupId === groupId)
        const selectedInGroup = selectedElements.filter(el => el.groupId === groupId)
        return groupElements.length === selectedInGroup.length
      })

      // 优化显示：如果是纯粹的组合选中（没有散乱元素），则只显示紫色组合框
      if (allGroupElementsComplete && nonGroupElements.length === 0) {
        groupIds.forEach(groupId => {
          const groupElements = store.elements.filter(el => el.groupId === groupId)
          if (groupElements.length > 0) {
            drawGroupHighlight(ctx, groupElements, scale)
          }
        })
      }
      // 混合多选显示：既有独立元素又有组合，或者组合未全选
      else {
        const allElementsForBoundingBox = [...nonGroupElements]

        groupIds.forEach(groupId => {
          const groupElements = store.elements.filter(el => el.groupId === groupId)
          allElementsForBoundingBox.push(...groupElements)
        })

        // 绘制每个独立选中的蓝色边框
        nonGroupElements.forEach(el => {
          Renderer.drawHighlight(ctx, el, scale)
        })

        // 绘制包裹所有选中项的蓝色大虚线框
        if (allElementsForBoundingBox.length > 0) {
          drawMultiSelectHighlight(ctx, allElementsForBoundingBox, scale, false)
        }

        // 如果在多选状态下存在完整的组合，额外绘制紫色细线框用于视觉提示
        groupIds.forEach(groupId => {
          const groupElements = store.elements.filter(el => el.groupId === groupId)
          const selectedInGroup = selectedElements.filter(el => el.groupId === groupId)

          if (groupElements.length === selectedInGroup.length) {
            drawGroupHighlight(ctx, groupElements, scale)
          }
        })
      }
    }

    ctx.restore()
    if (store.snapLines && store.snapLines.length > 0) {
      drawSnapLines(ctx, store.snapLines, store.viewport, width, height)
    }

    // 递归调用，实现 60FPS 动画循环
    animationFrameId = requestAnimationFrame(renderLoop)
  }

  /**
   * 停止渲染循环：用于组件销毁时释放资源
   */
  const stopLoop = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
  }

  return { initCanvas, renderLoop, stopLoop }
}