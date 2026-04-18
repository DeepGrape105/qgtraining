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
/**
 * 核心画布板组件 (CanvasBoard)
 * 该组件作为编辑器的主入口，负责集成渲染引擎、交互逻辑、状态管理及持久化。
 */
import { ref, onMounted } from 'vue'
import Toolbar from './Toolbar.vue'
import RightSidebar from './RightSidebar.vue'
import TextEditor from './TextEditor.vue'
import Minimap from './Minimap.vue'

// 业务逻辑抽离 (Composables)
import { useCanvas } from '../composables/useCanvas'           // 基础渲染引擎
import { useInteraction } from '../composables/useInteraction' // 鼠标交互算法
import { usePersistence } from '../composables/usePersistence'       // 本地存储持久化
import { useKeyboard } from '../composables/useKeyboard'       // 全局快捷键处理
import { useHistory } from '../composables/useHistory'         // 历史栈记录 (Undo/Redo)
import { useViewport } from '../composables/useViewport'       // 视口平移与缩放逻辑
import { useCanvasStore } from '../store/canvasStore'         // 全局状态管理

// 响应式引用
const canvasRef = ref(null)
const store = useCanvasStore()

// 结构化 Hooks 接口
const { initCanvas, renderLoop } = useCanvas()
const { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel } = useInteraction()
const { initAutoSave, loadLocalData } = usePersistence()
const { undo, redo } = useHistory()
const { zoomIn, zoomOut } = useViewport()

// 初始化全局快捷键监听（如：Ctrl+S, Ctrl+Z, Space等）
useKeyboard()

/** * 事件转发：将 DOM 事件上下文传递给交互逻辑层
 * @param {MouseEvent} e 
 */
const onMouseDown = (e) => handleMouseDown(e, canvasRef.value)
const onMouseMove = (e) => handleMouseMove(e, canvasRef.value)
const onMouseUp = () => handleMouseUp(null, canvasRef.value)
const onWheel = (e) => handleWheel(e, canvasRef.value)

/**
 * 缩放处理：计算视口中心点并执行缩放
 * 这样可以确保缩放效果是以屏幕中心为原点扩散的
 */
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

/**
 * 组件挂载流程：
 * 1. 优先加载本地历史数据
 * 2. 初始化 Canvas 上下文 (Context2D/WebGL)
 * 3. 开启渲染循环 (requestAnimationFrame)
 * 4. 激活数据自动保存机制
 */
onMounted(() => {
  if (canvasRef.value) {
    loadLocalData()         // 加载缓存
    initCanvas(canvasRef.value) // 设置画布尺寸与环境
    renderLoop()            // 启动帧渲染
    initAutoSave()          // 启动防抖持久化
  }
})
</script>

<style scoped src="../styles/canvasBoard.css"></style>