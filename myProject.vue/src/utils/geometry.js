// src/utils/Geometry.js

/**
 * 获取单个图元的轴对齐包围盒 (AABB - Axis-Aligned Bounding Box)
 * 职责：将不同类型的几何实体（点集、圆心半径、矩形描述）统一抽象为标准矩形边界。
 * * @param {Object} el - 图元对象
 * @returns {Object} 包含最小/最大坐标、尺寸及几何中心的边界对象
 */
export function getElementBounds(el) {
  // 针对多边形（三角形）：通过遍历顶点坐标序列寻找极值点
  if (el.type === 'triangle') {
    const xs = el.points.map(p => p.x)
    const ys = el.points.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    return {
      minX, minY, maxX, maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: minX + (maxX - minX) / 2,
      centerY: minY + (maxY - minY) / 2
    }
  }

  // 针对圆形：基于圆心坐标向四周扩散半径长度
  if (el.type === 'circle') {
    return {
      minX: el.x - el.radius,
      minY: el.y - el.radius,
      maxX: el.x + el.radius,
      maxY: el.y + el.radius,
      width: el.radius * 2,
      height: el.radius * 2,
      centerX: el.x,
      centerY: el.y
    }
  }

  // 针对矩形、文本或通用图元：基于左上角锚点与宽高计算
  // 备注：对文本类型提供默认尺寸降级方案，防止渲染前尺寸为 0 导致计算失效
  const w = el.width || (el.type === 'text' ? 100 : 0)
  const h = el.height || (el.type === 'text' ? 20 : 0)
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + w,
    maxY: el.y + h,
    width: w,
    height: h,
    centerX: el.x + w / 2,
    centerY: el.y + h / 2
  }
}

/**
 * 计算多个图元的并集边界 (Aggregate Bounds)
 * 常用于多选操作、群组计算或场景自动聚焦逻辑。
 * * @param {Array} elements - 需要参与计算的图元集合
 * @returns {Object} 覆盖所有输入图元的最小公共外接矩形
 */
export function getElementsBounds(elements) {
  // 空态处理：返回零点对齐的空包围盒，防止 Math.min/max 抛出异常
  if (!elements || elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  // 迭代计算：通过逐一合并单个 AABB 的极值点，递归扩张总包围盒
  elements.forEach(el => {
    const bounds = getElementBounds(el)
    minX = Math.min(minX, bounds.minX)
    minY = Math.min(minY, bounds.minY)
    maxX = Math.max(maxX, bounds.maxX)
    maxY = Math.max(maxY, bounds.maxY)
  })

  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: minX + (maxX - minX) / 2,
    centerY: minY + (maxY - minY) / 2
  }
}

/**
 * 2D 空间点绕中心旋转变换
 * 实现标准的旋转矩阵算法：[x', y', 1] = [x, y, 1] * T(-cx,-cy) * R(θ) * T(cx,cy)
 * * @param {Object} point - 目标点坐标 {x, y}
 * @param {Object} center - 旋转中心锚点 {x, y}
 * @param {number} angleDeg - 旋转角度（角度制）
 * @returns {Object} 变换后的新坐标
 */
export function rotatePoint(point, center, angleDeg) {
  // 性能优化：无旋转角度时直接返回原始坐标副本
  if (!angleDeg) return { x: point.x, y: point.y }

  const rad = (angleDeg * Math.PI) / 180 // 角度转弧度
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // 1. 将坐标平移至原点（以中心点为相对参考系）
  const dx = point.x - center.x
  const dy = point.y - center.y

  // 2. 应用旋转矩阵：
  // x' = x * cos(θ) - y * sin(θ)
  // y' = x * sin(θ) + y * cos(θ)
  // 3. 将坐标还原回原始空间
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  }
}