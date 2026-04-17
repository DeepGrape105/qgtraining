/**
定义一些数学相关的工具函数，
 1.比如判断点是否在某个元素内（矩形、圆形、三角形等）。
 2.可以根据需要扩展更多的几何形状和相关的数学计算函数。
*/

/**
 * 判断点是否在矩形内，判断条件为：px在x和x+width之间，py在y和y+height之间
 */
export function isPointInRect(px, py, rect) {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/**
 * 判断点是否在圆形内
 * 公式：(px-x)^2 + (py-y)^2 <= r^2
 */
export function isPointInCircle(px, py, circle) {
  const dx = px - circle.x;
  const dy = py - circle.y;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

/**
 * 判断点是否在三角形内（面积法）
 * 步骤：
 * 1.计算三角形的总面积ABC，用到鞋带公式：Area = |(x1(y2-y3) + x2(y3-y1) + x3(y1-y2)) / 2|
 * 2.计算点与三角形三个顶点组成的三个小三角形的面积PBC、PAC、PAB。
 * 3.如果PBC + PAC + PAB等于ABC，说明点在三角形内部。
 */
export function isPointInTriangle(px, py, triangle) {
  const [p1, p2, p3] = triangle.points;

  // 计算三角形面积的函数
  const getArea = (a, b, c) => {
    return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2.0);
  };

  const ABC = getArea(p1, p2, p3);
  const PBC = getArea({ x: px, y: py }, p2, p3);
  const PAC = getArea({ x: px, y: py }, p1, p3);
  const PAB = getArea({ x: px, y: py }, p1, p2);

  // 如果三个子三角形面积之和等于大三角形面积，说明点在内部
  return Math.abs(ABC - (PBC + PAC + PAB)) < 0.1;
}

/**
 * 统一判定入口
 */
export function isPointInElement(px, py, element) {
  switch (element.type) {
    case 'rect': return isPointInRect(px, py, element);
    case 'circle': return isPointInCircle(px, py, element);
    case 'triangle': return isPointInTriangle(px, py, element);
    case 'image': return isPointInImage(px, py, element);
    case 'text': return isPointInText(px, py, element);
    default: return false;
  }
}

export function isPointInImage(px, py, image) {
  return (
    px >= image.x &&
    px <= image.x + image.width &&
    py >= image.y &&
    py <= image.y + image.height
  )
}

export function isPointInText(px, py, textElement) {
  // 文本判定通常基于其渲染出的左上角坐标
  const w = textElement.width || 0;
  const h = textElement.height || (textElement.fontSize || 20);

  return (
    px >= textElement.x &&
    px <= textElement.x + w &&
    py >= textElement.y &&
    py <= textElement.y + h
  );
}

export function isElementInRect(element, rect) {
  let elRect

  if (element.type === 'rect' || element.type === 'image') {
    elRect = { x: element.x, y: element.y, width: element.width, height: element.height }
  } else if (element.type === 'circle') {
    elRect = {
      x: element.x - element.radius,
      y: element.y - element.radius,
      width: element.radius * 2,
      height: element.radius * 2
    }
  } else if (element.type === 'triangle') {
    const xs = element.points.map(p => p.x)
    const ys = element.points.map(p => p.y)
    elRect = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    }
  } else if (element.type === 'text') {
    elRect = {
      x: element.x,
      y: element.y,
      width: element.width || 100,
      height: element.height || 20
    }
  } else {
    return false
  }

  return !(elRect.x + elRect.width < rect.x ||
    rect.x + rect.width < elRect.x ||
    elRect.y + elRect.height < rect.y ||
    rect.y + rect.height < elRect.y)
}

/**
 * 计算多选元素的包围盒中心
 */
export function getMultiSelectionCenter(elements) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  elements.forEach(el => {
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
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + (el.width || 0))
      maxY = Math.max(maxY, el.y + (el.height || 0))
    }
  })

  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2
  }
}

/**
 * 计算两点之间的距离
 */
export function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
}

/**
 * 计算缩放比例
 */
export function getScaleFactor(startDist, currentDist, min = 0.3, max = 3) {
  return Math.max(min, Math.min(max, currentDist / startDist))
}

// 计算点绕中心旋转后的坐标
export function rotatePoint(point, center, angle) {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  }
}

// 获取元素中心点
export function getElementCenter(el) {
  if (el.type === 'circle') {
    return { x: el.x, y: el.y }
  } else if (el.type === 'triangle') {
    const points = el.points
    return {
      x: (points[0].x + points[1].x + points[2].x) / 3,
      y: (points[0].y + points[1].y + points[2].y) / 3
    }
  } else {
    return {
      x: el.x + (el.width || 0) / 2,
      y: el.y + (el.height || 0) / 2
    }
  }
}