<template>
  <div class="editor-layout">
    <Toolbar />
    <div class="canvas-container">
      <canvas 
        ref="canvasRef"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @wheel="onWheel"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toolbar from './Toolbar.vue'
import { useCanvas } from '../composables/useCanvas'
import { useInteraction } from '../composables/useInteraction'
import { usePersistence } from '../hooks/usePersistence'

const canvasRef = ref(null)
const { initCanvas, renderLoop } = useCanvas()
const { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel } = useInteraction()
const { initAutoSave, loadLocalData } = usePersistence()

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
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.canvas-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;  /* 背景由 canvas 自己画 */
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>