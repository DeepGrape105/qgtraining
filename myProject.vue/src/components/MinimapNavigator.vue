<template>
  <div class="minimap-anchor" v-show="hasBounds">
    <div class="minimap-track" ref="trackRef" @mousedown.stop="handleTrackClick">
      <canvas ref="wireframeCanvas" class="wireframe-canvas"></canvas>

      <div 
        class="viewport-slider" 
        :style="sliderStyle"
        @mousedown.stop="startDragging"
      ></div>
    </div>

    <div v-if="isInteracting" class="preview-panel">
      <canvas ref="previewCanvas" width="200" height="200"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useCanvasStore } from '../store/canvasStore'

const store = useCanvasStore()
const trackRef = ref(null)
const wireframeCanvas = ref(null)
const previewCanvas = ref(null)
const isInteracting = ref(false)

const MINI_SIZE = 150 

// 检查是否有有效边界
const hasBounds = computed(() => store.sceneBounds && store.sceneBounds.width > 0)

const mapMeta = computed(() => {
  // 核心：如果 sceneBounds 还没算出来，提供一个默认全屏边界防止崩溃
  const b = store.sceneBounds || { minX: 0, minY: 0, width: window.innerWidth, height: window.innerHeight }
  const ratio = Math.min(MINI_SIZE / b.width, MINI_SIZE / b.height)
  return { ratio, b }
})

const sliderStyle = computed(() => {
  const { ratio, b } = mapMeta.value
  const { offsetX, offsetY, scale } = store.viewport
  
  // 计算当前视口在世界坐标系的大小
  const vw = window.innerWidth / scale
  const vh = window.innerHeight / scale
  const vx = -offsetX / scale
  const vy = -offsetY / scale

  return {
    left: `${(vx - b.minX) * ratio}px`,
    top: `${(vy - b.minY) * ratio}px`,
    width: `${vw * ratio}px`,
    height: `${vh * ratio}px`
  }
})

// 绘制函数
const drawAll = (ctx, isPreview = false, targetWorldX = 0, targetWorldY = 0) => {
  const { ratio, b } = mapMeta.value
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  
  ctx.save()
  if (isPreview) {
    // 预览模式：以滑块中心为原点，放大显示
    ctx.scale(0.8, 0.8) // 预览窗略微缩小内容
    ctx.translate(-targetWorldX + 100, -targetWorldY + 100)
  } else {
    // 普通模式：映射到小地图尺寸
    ctx.scale(ratio, ratio)
    ctx.translate(-b.minX, -b.minY)
  }

  ctx.strokeStyle = isPreview ? '#3b82f6' : 'rgba(0,0,0,0.2)'
  ctx.lineWidth = isPreview ? 2 : 1 / ratio 

  store.elements.forEach(el => {
    ctx.save()
    ctx.translate(el.x + el.width/2, el.y + el.height/2)
    ctx.rotate((el.rotation || 0) * Math.PI / 180)
    ctx.translate(-el.width/2, -el.height/2)
    
    ctx.beginPath()
    if (el.type === 'circle') ctx.arc(el.width/2, el.height/2, el.width/2, 0, Math.PI*2)
    else if (el.type === 'triangle') {
      ctx.moveTo(el.width/2, 0); ctx.lineTo(el.width, el.height); ctx.lineTo(0, el.height); ctx.closePath()
    } else ctx.rect(0, 0, el.width, el.height)
    ctx.stroke()
    ctx.restore()
  })
  ctx.restore()
}

// 监听元素变化重绘背景
watch(() => store.elements, () => {
  if (!wireframeCanvas.value) return
  wireframeCanvas.value.width = MINI_SIZE
  wireframeCanvas.value.height = MINI_SIZE
  drawAll(wireframeCanvas.value.getContext('2d'))
}, { deep: true, immediate: true })

// 交互逻辑
let isDragging = false
const startDragging = (e) => {
  isDragging = true
  isInteracting.value = true
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', stopMove)
}

const handleMove = (e) => {
  if (!isDragging) return
  const rect = trackRef.value.getBoundingClientRect()
  const { ratio, b } = mapMeta.value
  
  const worldX = (e.clientX - rect.left) / ratio + b.minX
  const worldY = (e.clientY - rect.top) / ratio + b.minY

  // 同步主画布
  store.viewport.offsetX = window.innerWidth/2 - worldX * store.viewport.scale
  store.viewport.offsetY = window.innerHeight/2 - worldY * store.viewport.scale
  
  // 更新预览窗
  nextTick(() => {
    if (previewCanvas.value) drawAll(previewCanvas.value.getContext('2d'), true, worldX, worldY)
  })
}

const stopMove = () => {
  isDragging = false
  isInteracting.value = false
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', stopMove)
}
</script>

<style scoped>
.minimap-anchor {
  position: absolute;
  left: 30px; /* 改为左侧 */
  bottom: 30px;
  display: flex;
  align-items: flex-end;
  gap: 20px;
  z-index: 9999; /* 确保在最上层 */
  pointer-events: none;
}

.minimap-track {
  width: 150px;
  height: 150px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
  pointer-events: auto; /* 恢复点击 */
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.wireframe-canvas { width: 100%; height: 100%; pointer-events: none; }

.viewport-slider {
  position: absolute;
  border: 2px solid #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  cursor: grab;
  z-index: 10;
}

.preview-panel {
  width: 200px;
  height: 200px;
  background: white;
  border-radius: 16px;
  border: 2px solid #3b82f6;
  box-shadow: 0 12px 40px rgba(0,0,0,0.2);
  overflow: hidden;
}
</style>