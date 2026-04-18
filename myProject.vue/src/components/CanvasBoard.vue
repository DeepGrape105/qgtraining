<template>
  <div class="editor-layout">
    <Toolbar />

    <div class="main-content">
      <div class="canvas-container">
        <canvas 
          ref="canvasRef"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @wheel="onWheel"
        ></canvas>
        <TextEditor />
        
        <!-- 左下角竖向控制按钮 -->
        <div class="bottom-left-controls-vertical">
          <button class="ctrl-btn" @click="undo" title="撤销 (Ctrl+Z)">↩️</button>
          <button class="ctrl-btn" @click="redo" title="重做 (Ctrl+Y)">↪️</button>
          <div class="divider-horizontal"></div>
          <button class="ctrl-btn" @click="handleZoomIn" title="放大 (Ctrl+=)">➕</button>
          <span class="zoom-level">{{ Math.round(store.viewport.scale * 100) }}%</span>
          <button class="ctrl-btn" @click="handleZoomOut" title="缩小 (Ctrl+-)">➖</button>
        </div>
      </div>
      <RightSidebar />
    </div>
    <Minimap />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toolbar from './Toolbar.vue'
import RightSidebar from './RightSidebar.vue'
import TextEditor from './TextEditor.vue'
import Minimap from './Minimap.vue'
import { useCanvas } from '../composables/useCanvas'
import { useInteraction } from '../composables/useInteraction'
import { usePersistence } from '../hooks/usePersistence'
import { useKeyboard } from '../composables/useKeyboard'
import { useHistory } from '../composables/useHistory'
import { useViewport } from '../composables/useViewport'
import { useCanvasStore } from '../store/canvasStore'

const canvasRef = ref(null)
const store = useCanvasStore()
const { initCanvas, renderLoop } = useCanvas()
const { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel } = useInteraction()
const { initAutoSave, loadLocalData } = usePersistence()
const { undo, redo } = useHistory()
const { zoomIn, zoomOut, resetViewport } = useViewport()

// 启动快捷键监听
useKeyboard()

const onMouseDown = (e) => handleMouseDown(e, canvasRef.value)
const onMouseMove = (e) => handleMouseMove(e, canvasRef.value)
const onMouseUp = () => handleMouseUp(null, canvasRef.value)
const onWheel = (e) => handleWheel(e, canvasRef.value)

// 缩放处理（获取画布中心点）
const handleZoomIn = () => {
  const vw = canvasRef.value?.clientWidth || window.innerWidth
  const vh = canvasRef.value?.clientHeight || window.innerHeight
  zoomIn(vw / 2, vh / 2)
}

const handleZoomOut = () => {
  const vw = canvasRef.value?.clientWidth || window.innerWidth
  const vh = canvasRef.value?.clientHeight || window.innerHeight
  zoomOut(vw / 2, vh / 2)
}

const resetView = () => {
  resetViewport()
}

onMounted(() => {
  if (canvasRef.value) {
    loadLocalData()
    initCanvas(canvasRef.value)
    renderLoop()
    initAutoSave()
  }
})
</script>

<style scoped src="../styles/canvasBoard.css"></style>