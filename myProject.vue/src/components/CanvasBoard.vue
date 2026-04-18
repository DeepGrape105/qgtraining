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
      </div><RightSidebar /></div>
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

const canvasRef = ref(null)
const { initCanvas, renderLoop } = useCanvas()
const { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel } = useInteraction()
const { initAutoSave, loadLocalData } = usePersistence()

// 启动快捷键监听
useKeyboard()

const onMouseDown = (e) => handleMouseDown(e, canvasRef.value)
const onMouseMove = (e) => handleMouseMove(e, canvasRef.value)
const onMouseUp = () => handleMouseUp(null, canvasRef.value)
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

<style scoped src="../styles/canvasBoard.css"></style>