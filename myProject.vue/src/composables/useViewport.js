import { useCanvasStore } from '../store/canvasStore'

/**
 * useViewport Composable
 * * 职责域：
 * 1. 视口状态管理：控制画布的位移 (Pan) 与缩放 (Zoom)。
 * 2. 仿射变换计算：处理基于特定锚点的缩放投影，确保视觉焦点一致性。
 * 3. 边界约束：实施缩放因子的上下限限制，防止渲染溢出或反转。
 */
export function useViewport() {
  const store = useCanvasStore()

  /**
   * 获取当前视口快照
   * 包含 offsetX (水平偏移), offsetY (垂直偏移), scale (缩放比例)
   */
  const getViewport = () => store.viewport

  /**
   * 平移视口 (Panning)
   * 依据屏幕坐标系的增量直接更新世界坐标系的偏移量
   * @param {number} dx - 水平方向位移像素值
   * @param {number} dy - 垂直方向位移像素值
   */
  const panViewport = (dx, dy) => {
    store.viewport.offsetX += dx
    store.viewport.offsetY += dy
  }

  /**
   * 放大视口 (Zoom In)
   * 采用几何指数增长策略，并锚定当前鼠标位置执行变换补偿
   * @param {number} centerX - 缩放锚点的屏幕 X 坐标（通常为鼠标位置）
   * @param {number} centerY - 缩放锚点的屏幕 Y 坐标
   */
  const zoomIn = (centerX, centerY) => {
    const { scale, offsetX, offsetY } = store.viewport
    // 设置硬上限为 5.0 (500%)，防止无限放大导致精度丢失
    const newScale = Math.min(scale * 1.1, 5)
    if (newScale === scale) return

    /**
     * 【核心算法：锚点缩放补偿】
     * 为了让缩放中心点在视觉上保持固定，需要计算缩放比例变化后的偏移修正：
     * NewOffset = Anchor - (Anchor - OldOffset) * (NewScale / OldScale)
     */
    const ratio = newScale / scale
    store.viewport.offsetX = centerX - (centerX - offsetX) * ratio
    store.viewport.offsetY = centerY - (centerY - offsetY) * ratio
    store.viewport.scale = newScale
  }

  /**
   * 缩小视口 (Zoom Out)
   * 采用几何衰减策略，并锚定当前鼠标位置执行变换补偿
   * @param {number} centerX - 缩放锚点的屏幕 X 坐标
   * @param {number} centerY - 缩放锚点的屏幕 Y 坐标
   */
  const zoomOut = (centerX, centerY) => {
    const { scale, offsetX, offsetY } = store.viewport
    // 设置硬下限为 0.1 (10%)，防止视口坍缩
    const newScale = Math.max(scale * 0.9, 0.1)
    if (newScale === scale) return

    const ratio = newScale / scale
    store.viewport.offsetX = centerX - (centerX - offsetX) * ratio
    store.viewport.offsetY = centerY - (centerY - offsetY) * ratio
    store.viewport.scale = newScale
  }

  /**
   * 显式重置视口状态
   * 常用于“适应屏幕”、“居中查看”或从小地图同步坐标
   * @param {number} offsetX - 目标水平偏移
   * @param {number} offsetY - 目标垂直偏移
   * @param {number} scale - 目标缩放比例
   */
  const setViewport = (offsetX, offsetY, scale) => {
    store.viewport.offsetX = offsetX
    store.viewport.offsetY = offsetY
    // 强制执行合法范围校验
    store.viewport.scale = Math.min(5, Math.max(0.1, scale))
  }

  return { getViewport, panViewport, zoomIn, zoomOut, setViewport }
}