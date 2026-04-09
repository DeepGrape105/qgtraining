<template>
  <div class="editor-layout">
    <Toolbar />
    <div class="canvas-container">
      <canvas 
        ref="canvasRef"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Toolbar from './Toolbar.vue';
import { useCanvas } from '../composables/useCanvas';
import { useInteraction } from '../composables/useInteraction';
import { usePersistence } from '../hooks/usePersistence';

// canvasRef 用于获取 canvas DOM 元素的引用，供 useCanvas 和 useInteraction 使用
const canvasRef = ref(null);
const { initCanvas, renderLoop } = useCanvas();
const { handleMouseDown, handleMouseMove, handleMouseUp } = useInteraction();
const { initAutoSave, loadLocalData } = usePersistence();

// 转发事件，并传入 canvas 实例供坐标转换使用
const onMouseDown = (e) => handleMouseDown(e, canvasRef.value);
const onMouseMove = (e) => handleMouseMove(e, canvasRef.value);
const onMouseUp = () => handleMouseUp();

onMounted(() => {
  if (canvasRef.value) {
    // 1. 先尝试加载本地数据
    loadLocalData();
    // 2. 初始化画布
    initCanvas(canvasRef.value);
    // 3. 启动渲染循环
    renderLoop();
    // 4. 开启自动保存
    initAutoSave();
  }
});
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
  background-color: #f0f2f5;
}
canvas {
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
  background-color: white;
}
</style>