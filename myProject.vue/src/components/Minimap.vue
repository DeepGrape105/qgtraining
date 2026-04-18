<template>
  <div class="minimap-container">
    <canvas
      ref="minimapCanvas"
      class="minimap-canvas"
      :width="minimapSize"
      :height="minimapSize"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    />
  </div>
</template>

<script setup>
/**
 * Minimap 组件
 * 功能：提供全局视图预览，支持通过点击和拖拽缩略图区域来快速移动主画布视口。
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useMinimap } from '../composables/useMinimap'
import { drawMinimap } from '../utils/minimapRenderer'

// 状态管理与常量定义
const store = useCanvasStore()
const minimapSize = 120 // 缩略图正方形边长固定为 120px

// DOM 引用与拖拽状态
const minimapCanvas = ref(null)
const isDragging = ref(false)
let dragOffsetX = 0 // 鼠标相对于缩略图视口框左上角的偏移 X
let dragOffsetY = 0 // 鼠标相对于缩略图视口框左上角的偏移 Y

/**
 * 引入缩略图核心逻辑 Hooks
 * @param {number} minimapSize 缩略图尺寸
 * @returns {Object} 包含边界计算、比例转换及视口更新的方法
 */
const {
  bounds,                 // 当前画布所有元素构成的总边界
  minimapScale,           // 画布总区域缩放到缩略图尺寸的比例
  getViewportRect,        // 获取主视口在缩略图上的映射矩形 (x, y, w, h)
  updateViewportByRect,   // 根据缩略图上的矩形坐标反向更新主画布视口
  isPointInViewportRect,  // 判断坐标是否落在缩略图视口框内
  canPan                  // 判断当前是否满足平移条件（如内容超出视口）
} = useMinimap(minimapSize)

let rafId = null // 用于存储 RequestAnimationFrame 的 ID，优化渲染性能

/**
 * 执行缩略图渲染
 * 负责清除画布并调用渲染工具函数绘制元素预览和视口高亮框
 */
const renderMinimap = () => {
  const canvas = minimapCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  
  // 获取父容器（主画布容器）的实际尺寸，用于计算比例
  const vw = canvas.parentElement?.clientWidth || 800
  const vh = canvas.parentElement?.clientHeight || 600
  
  // 调用外部工具函数进行 Canvas 绘制
  drawMinimap(ctx, minimapSize, bounds, minimapScale, getViewportRect, vw, vh)
}

/**
 * 调度渲染任务
 * 使用 requestAnimationFrame 确保在浏览器刷新频率内仅执行一次渲染，避免性能浪费
 */
const scheduleRender = () => {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    renderMinimap()
    rafId = null
  })
}

/**
 * 监听数据变化
 * 当画布元素（store.elements）改变或视口位置/缩放（store.viewport）改变时，重新绘制缩略图
 */
watch(() => [store.elements, store.viewport], scheduleRender, { deep: true })

/**
 * 处理鼠标按下事件
 * 用于启动拖拽逻辑
 */
const handleMouseDown = (e) => {
  const canvas = minimapCanvas.value
  if (!canvas) return
  
  // 计算鼠标在缩略图 Canvas 内部的相对坐标
  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const vw = canvas.parentElement?.clientWidth || 800
  const vh = canvas.parentElement?.clientHeight || 600

  // 校验当前是否允许平移（如果内容没超出视口，则无需平移）
  if (!canPan(vw, vh)) return

  // 获取当前缩略图上的视口框位置
  const viewportRect = getViewportRect(vw, vh)
  
  // 仅当点击位置在缩略图的视口高亮框内时，激活拖拽
  if (isPointInViewportRect(mouseX, mouseY, vw, vh)) {
    isDragging.value = true
    // 记录点击位置相对于视口框左上角的偏离值，保证拖拽平滑（不跳变）
    dragOffsetX = mouseX - viewportRect.x
    dragOffsetY = mouseY - viewportRect.y
    e.preventDefault() // 阻止默认选择行为
  }
}

/**
 * 处理鼠标移动事件
 * 实时同步缩略图拖拽位置到主画布视口
 */
const handleMouseMove = (e) => {
  if (!isDragging.value) return
  const canvas = minimapCanvas.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const vw = canvas.parentElement?.clientWidth || 800
  const vh = canvas.parentElement?.clientHeight || 600

  if (!canPan(vw, vh)) return

  // 计算视口框在缩略图上的目标新位置（减去初始点击偏移）
  const rectX = mouseX - dragOffsetX
  const rectY = mouseY - dragOffsetY

  // 核心逻辑：根据缩略图坐标偏移，反向计算并更新 Store 中的主视口位置
  updateViewportByRect(rectX, rectY, vw, vh)
  scheduleRender() // 实时重绘缩略图
}

/**
 * 停止拖拽
 */
const handleMouseUp = () => {
  isDragging.value = false
}

// 生命周期：组件挂载后进行首次渲染
onMounted(renderMinimap)

// 生命周期：组件销毁前清理动画帧，防止内存泄漏
onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped src="../styles/minimap.css"></style>