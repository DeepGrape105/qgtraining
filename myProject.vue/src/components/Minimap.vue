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
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useMinimap } from '../composables/useMinimap'
import { drawMinimap } from '../utils/minimapRenderer'

const store = useCanvasStore()
const minimapSize = 120

const minimapCanvas = ref(null)
const isDragging = ref(false)
let dragOffsetX = 0
let dragOffsetY = 0

const {
  bounds,
  minimapScale,
  getViewportRect,
  updateViewportByRect,
  isPointInViewportRect,
  canPan
} = useMinimap(minimapSize)

let rafId = null

const renderMinimap = () => {
  const canvas = minimapCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const vw = canvas.parentElement?.clientWidth || 800
  const vh = canvas.parentElement?.clientHeight || 600
  drawMinimap(ctx, minimapSize, bounds, minimapScale, getViewportRect, vw, vh)
}

const scheduleRender = () => {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    renderMinimap()
    rafId = null
  })
}

watch(() => [store.elements, store.viewport], scheduleRender, { deep: true })

const handleMouseDown = (e) => {
  const canvas = minimapCanvas.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const vw = canvas.parentElement?.clientWidth || 800
  const vh = canvas.parentElement?.clientHeight || 600

  if (!canPan(vw, vh)) return

  const viewportRect = getViewportRect(vw, vh)
  if (isPointInViewportRect(mouseX, mouseY, vw, vh)) {
    isDragging.value = true
    dragOffsetX = mouseX - viewportRect.x
    dragOffsetY = mouseY - viewportRect.y
    e.preventDefault()
  }
}

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

  const rectX = mouseX - dragOffsetX
  const rectY = mouseY - dragOffsetY

  updateViewportByRect(rectX, rectY, vw, vh)
  scheduleRender()
}

const handleMouseUp = () => {
  isDragging.value = false
}

onMounted(renderMinimap)
onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped src="../styles/minimap.css"></style>