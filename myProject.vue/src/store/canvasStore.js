// 画布状态管理，使用 Pinia 定义全局状态
import { defineStore } from 'pinia'

// 创建画布状态管理的 Pinia store，里面包含了画布元素列表、当前选中元素ID以及画布配置等状态，以及更新元素属性的 action 方法
export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    // 所有的画布元素，严格遵守文档中的 Element Schema
    // elements: [
    //   {
    //     id: 'rect_initial_test', // 唯一标识符
    //     type: 'rect',          // 元素类型
    //     x: 100,
    //     y: 100,
    //     width: 200,
    //     height: 150,
    //     fill: '#ff4757',       // 填充颜色，默认红色
    //     stroke: '#2f3542',     // 边框颜色
    //     strokeWidth: 2,        // 边框粗细
    //     opacity: 1,            // 透明度
    //     zIndex: 1,             // 层级顺序
    //     rotation: 0            // 旋转角度
    //   }
    // ],
    elements: [
      {
        id: 'rect_1',
        type: 'rect',
        x: 50, y: 50, width: 100, height: 100,
        fill: '#ff4757', stroke: '#2f3542', strokeWidth: 2, opacity: 1, zIndex: 1
      },
      {
        id: 'circle_1',
        type: 'circle',
        x: 300, y: 150,
        radius: 50, // 圆形特有属性
        fill: '#1e90ff', stroke: '#2f3542', strokeWidth: 2, opacity: 1, zIndex: 2
      },
      {
        id: 'triangle_1',
        type: 'triangle',
        // 三角形由三个顶点坐标决定
        points: [
          { x: 500, y: 50 },  // 顶点
          { x: 450, y: 150 }, // 左下
          { x: 550, y: 150 }  // 右下
        ],
        fill: '#2ed573', stroke: '#2f3542', strokeWidth: 2, opacity: 1, zIndex: 3
      }
    ],
    // 当前选中的元素ID，初始化为 null
    selection: null,
    // 画布全局配置
    canvasConfig: {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff'
    }
  }),
  actions: {
    /**
     * 更新指定元素的属性
     * @param {string} id 元素的唯一 ID
     * @param {object} props 需要更新的属性对象
     */
    updateElement(id, props) {
      if (!id || !props) return; // 防错：参数缺失直接返回

      const index = this.elements.findIndex(el => el.id === id)
      if (index !== -1) {
        // 使用对象展开符合并属性，保持其他属性不变
        this.elements[index] = { ...this.elements[index], ...props }
      } else {
        console.warn(`[CanvasStore] Element with id ${id} not found.`);
      }
    }
  }
})