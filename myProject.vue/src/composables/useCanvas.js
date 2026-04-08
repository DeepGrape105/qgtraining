// 画布相关的核心逻辑封装在这个 composable 中，提供初始化和调整像素，渲染循环等功能
import Renderer from '../composables/Renderer'
import { useCanvasStore } from '../store/canvasStore'

export function useCanvas() {
  // 获取画布状态管理的 Pinia store 实例，后续会从这个 store 中读取元素列表和画布配置等状态
  const store = useCanvasStore()
  let ctx = null
  let canvas = null
  let animationFrameId = null; // 用于可能需要的清理工作

  /**
   * 初始化 Canvas
   * @param {HTMLCanvasElement} canvasEl 画布的 DOM 引用
   */
  const initCanvas = (canvasEl) => {
    if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) {
      console.error('[useCanvas] Invalid canvas element provided.');
      return;
    }// 基础检查，确保传入了有效的 canvas 元素

    // 获取 2D 绘图上下文
    canvas = canvasEl
    ctx = canvas.getContext('2d', { alpha: false })

    if (!ctx) {
      console.error('[useCanvas] Failed to get 2D context.');
      return;
    }// 基础检查，确保获取到了 2D 绘图上下文


    // 处理高清屏（Retina）模糊问题，获取设备像素比（DPR），并根据画布配置调整实际渲染的像素尺寸和样式尺寸，同时缩放绘图上下文以适配 DPR，保证后续绘图指令的坐标和尺寸不受 DPR 影响
    const dpr = window.devicePixelRatio || 1
    const { width, height } = store.canvasConfig

    // 1. 设置 Canvas 实际渲染的物理像素
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    // 2. 设置在网页上显示的逻辑像素
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // 3. 缩放绘图上下文，保证后续绘图指令不受 DPR 影响
    ctx.scale(dpr, dpr)
  }

  /**
   * 渲染循环，由 requestAnimationFrame 驱动
   */
  const renderLoop = () => {
    if (!ctx || !canvas) return; // 防止未初始化时运行

    try {
      // 1. 获取当前画布配置
      const { width, height, backgroundColor } = store.canvasConfig;

      // 2. 清空画布
      ctx.clearRect(0, 0, width, height)

      // 3. 绘制底色背景
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, width, height)
      }

      // 4. 排序并渲染元素（通过 zIndex 控制层级），用sort方法排序小的 zIndex 在前，大的在后，保证后渲染的元素覆盖在前面
      const sortedElements = [...store.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      // 5. 逐个渲染
      for (const el of sortedElements) {
        Renderer.draw(ctx, el);
      }
    } catch (err) {
      console.error('[renderLoop] Error during rendering:', err);
    }

    // 请求下一帧
    animationFrameId = requestAnimationFrame(renderLoop)
  }

  // 清理函数
  const stopLoop = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  }

  // 返回初始化函数和渲染循环控制函数，供组件使用
  return { initCanvas, renderLoop, stopLoop }
}