//本文件用于处理鼠标交互的逻辑，包括拖拽、移动等操作

//需要引入 store 来获取元素数据，以及引入数学工具函数来判断点是否在元素内
import { useCanvasStore } from '../store/canvasStore';
import { isPointInElement } from '../utils/math';

export function useInteraction() {
  const store = useCanvasStore();

  // 内部状态，不需要暴露给外部
  let isDragging = false;
  let lastMousePos = { x: 0, y: 0 };

  /**
   * 核心：坐标转换
   * 将鼠标在屏幕上的 clientX/Y 转为相对于 Canvas 左上角的坐标
   */
  const getCanvasCoords = (e, canvasEl) => {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e, canvasEl) => {
    const { x, y } = getCanvasCoords(e, canvasEl);
    lastMousePos = { x, y };

    // 拾取逻辑：从后往前找（zIndex 高的优先被选中）
    const target = [...store.elements]
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
      .find(el => isPointInElement(x, y, el));

    if (target) {
      store.selection = target.id; // 设为选中
      isDragging = true;
    } else {
      store.selection = null; // 点空白处清空选中
    }
  };

  const handleMouseMove = (e, canvasEl) => {
    if (!isDragging || !store.selection) return;

    const { x, y } = getCanvasCoords(e, canvasEl);
    const dx = x - lastMousePos.x; // 计算位移增量
    const dy = y - lastMousePos.y;

    const element = store.elements.find(el => el.id === store.selection);
    if (element) {
      // 针对不同形状更新坐标
      if (element.type === 'triangle') {
        const newPoints = element.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        store.updateElement(element.id, { points: newPoints });
      } else {
        store.updateElement(element.id, {
          x: element.x + dx,
          y: element.y + dy
        });
      }
    }

    lastMousePos = { x, y }; // 更新最后位置
  };

  const handleMouseUp = () => {
    isDragging = false;
  };

  return { handleMouseDown, handleMouseMove, handleMouseUp };
}