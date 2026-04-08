<template>
  <div class="canvas-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useCanvas } from '../composables/useCanvas'

// 创建一个响应式的引用，用于关联 template 中的 canvas 标签
const canvasRef = ref(null)
const { initCanvas, renderLoop, stopLoop } = useCanvas()

onMounted(() => {
  // 确保 DOM 已经渲染完毕，且获取到了真实的节点
  if (canvasRef.value) {
    initCanvas(canvasRef.value) // 传入 DOM 节点初始化
    renderLoop()                // 开启渲染循环
    console.log('[CanvasBoard] Canvas initialized successfully.');
  } else {
    console.error('[CanvasBoard] Canvas ref is null on mounted.');
  }
})

onUnmounted(() => {
    stopLoop(); // 组件卸载时停止渲染循环，防止内存泄漏
})
</script>

<style scoped>
.canvas-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
}
canvas {
  /* 添加轻微阴影，视觉上区分画布和背景 */
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
  background-color: white; 
}
</style>