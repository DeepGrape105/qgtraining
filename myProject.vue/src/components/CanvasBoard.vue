<template>
  <div class="editor-layout">
    <Toolbar />

    <div class="main-content">
      <LayerPanel />

      <div class="canvas-container">
        <canvas 
          ref="canvasRef"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @wheel="onWheel"
        ></canvas>
        <TextEditor />
      </div>

      <RightSidebar />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toolbar from './Toolbar.vue'
import LayerPanel from './LayerPanel.vue'
import RightSidebar from './RightSidebar.vue'
import TextEditor from './TextEditor.vue'
import { useCanvas } from '../composables/useCanvas'
import { useInteraction } from '../composables/useInteraction'
import { usePersistence } from '../hooks/usePersistence'
import { useKeyboard } from '../composables/useKeyboard'

const canvasRef = ref(null)
const { initCanvas, renderLoop } = useCanvas()
const { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel } = useInteraction()
const { initAutoSave, loadLocalData } = usePersistence()

// 启动快捷键监听
useKeyboard()

const onMouseDown = (e) => handleMouseDown(e, canvasRef.value)
const onMouseMove = (e) => handleMouseMove(e, canvasRef.value)
const onMouseUp = () => handleMouseUp()
const onWheel = (e) => handleWheel(e, canvasRef.value)

onMounted(() => {
  if (canvasRef.value) {
    loadLocalData()
    initCanvas(canvasRef.value)
    renderLoop()
    initAutoSave()
  }
})
</script>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f5f5;
}

.main-content {
  flex: 1;
  display: flex;
  position: relative; /* 方便内部绝对定位组件 */
  overflow: hidden;
}

.canvas-container {
  position: relative !important;
  overflow: hidden !important;  
  flex: 1;
  background-color: #eee;
  display: flex;
}

canvas {
  display: block;    /* 消除 canvas 底部的 4px 间隙 */
  width: 100%;
  height: 100%;
  position: absolute; /* 让 canvas 也绝对定位，不占空间 */
  left: 0;
  top: 0;
  z-index: 1;
}
:deep(.text-editor-overlay) {
  z-index: 1000 !important;
}
</style>