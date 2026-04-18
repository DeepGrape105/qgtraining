// src/composables/useMinimap.js
import { computed } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useViewport } from './useViewport'

/**
 * useMinimap Composable
 * * 职责：
 * 1. 空间边界计算：动态计算包含所有图元的世界坐标系 AABB 包围盒。
 * 2. 坐标投影：实现世界坐标到小地图等比例缩略坐标的线性映射。
 * 3. 视口联动：根据主画布的变换状态，计算并限制小地图中“高亮视口矩形”的位置与尺寸。
 */
export function useMinimap(minimapSize = 180) {
  const store = useCanvasStore()
  const { setViewport } = useViewport()

  /**
   * 动态边界计算 (Scene Bounds)
   * 遍历所有图元，实时计算出一个能够容纳所有内容的最大矩形区域。
   */
  const bounds = computed(() => {
    if (store.elements.length === 0) {
      // 缺省状态：若画布无内容，设定一个基础的 5000x5000 虚拟空间
      return { minX: 0, minY: 0, maxX: 5000, maxY: 5000 }
    }

    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    store.elements.forEach(el => {
      // 依据不同图元的几何特性提取边界极值
      if (el.type === 'circle') {
        minX = Math.min(minX, el.x - el.radius)
        minY = Math.min(minY, el.y - el.radius)
        maxX = Math.max(maxX, el.x + el.radius)
        maxY = Math.max(maxY, el.y + el.radius)
      } else if (el.type === 'triangle') {
        el.points.forEach(p => {
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        })
      } else {
        // 矩形、图片、文本图元
        minX = Math.min(minX, el.x)
        minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + (el.width || 0))
        maxY = Math.max(maxY, el.y + (el.height || 0))
      }
    })

    // 视觉填充 (Padding)：在真实边界外扩一圈，防止最边缘的图元在小地图中紧贴边框
    const padding = 200
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    }
  })

  /**
   * 小地图比例尺 (Minimap Scale)
   * 采用“等比自适应”算法：取长宽中较大的一方作为缩放基准，确保内容完整显示在固定尺寸的小地图容器内。
   */
  const minimapScale = computed(() => {
    const b = bounds.value
    const width = b.maxX - b.minX
    const height = b.maxY - b.minY
    return minimapSize / Math.max(width, height)
  })

  /**
   * 坐标转换：世界空间 -> 小地图空间
   * 算法：(WorldPoint - WorldOrigin) * MinimapScale
   */
  const worldToMinimap = (worldX, worldY) => {
    const b = bounds.value
    const s = minimapScale.value
    return {
      x: (worldX - b.minX) * s,
      y: (worldY - b.minY) * s
    }
  }

  /**
   * 计算视口高亮矩形 (Viewport Indicator)
   * 反推当前主画布视口在世界坐标中的投影，并映射到小地图坐标系。
   */
  const getViewportRect = (viewportWidth, viewportHeight) => {
    const { offsetX, offsetY, scale: viewportScale } = store.viewport
    const b = bounds.value
    const s = minimapScale.value

    // 1. 将视口屏幕坐标转换回世界坐标（反向变换）
    const worldX = -offsetX / viewportScale
    const worldY = -offsetY / viewportScale
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale

    // 2. 将世界坐标映射为小地图像素位置
    let x = (worldX - b.minX) * s
    let y = (worldY - b.minY) * s
    const w = worldW * s
    const h = worldH * s

    // 3. 边界约束 (Clamping)：确保高亮矩形不会超出小地图容器边界
    return {
      x: Math.max(0, Math.min(minimapSize - w, x)),
      y: Math.max(0, Math.min(minimapSize - h, y)),
      w: Math.min(w, minimapSize),
      h: Math.min(h, minimapSize)
    }
  }

  /**
   * 交互反馈：通过拖拽小地图矩形来更新视口 (Reverse Mapping)
   * 当用户在小地图上移动高亮框时，同步计算主画布应有的偏移量 (Offset)。
   */
  const updateViewportByRect = (rectX, rectY, viewportWidth, viewportHeight) => {
    const b = bounds.value
    const s = minimapScale.value
    const { scale: viewportScale } = store.viewport
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale

    // 1. 将小地图本地坐标还原为世界坐标
    let worldX = rectX / s + b.minX
    let worldY = rectY / s + b.minY

    // 2. 应用边界限制，防止视口游离出图元密集区
    worldX = Math.max(b.minX, Math.min(b.maxX - worldW, worldX))
    worldY = Math.max(b.minY, Math.min(b.maxY - worldH, worldY))

    // 3. 转换回主画布所需的逻辑偏移值 (Offset)
    const newOffsetX = -worldX * viewportScale
    const newOffsetY = -worldY * viewportScale

    // 调用视口更新接口
    setViewport(newOffsetX, newOffsetY, viewportScale, viewportWidth, viewportHeight)
  }

  /**
   * 命中测试：判定鼠标点击是否落在小地图视口矩形内
   */
  const isPointInViewportRect = (x, y, vw, vh) => {
    const r = getViewportRect(vw, vh)
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  }

  /**
   * 状态判定：检测当前视口是否“小于”内容边界
   * 用于决定是否需要显示平移手柄或启用平移交互
   */
  const canPan = (viewportWidth, viewportHeight) => {
    const b = bounds.value
    const { scale: viewportScale } = store.viewport
    const worldW = viewportWidth / viewportScale
    const worldH = viewportHeight / viewportScale
    return worldW < (b.maxX - b.minX) || worldH < (b.maxY - b.minY)
  }

  return {
    bounds,
    minimapScale,
    worldToMinimap,
    getViewportRect,
    updateViewportByRect,
    isPointInViewportRect,
    canPan
  }
}