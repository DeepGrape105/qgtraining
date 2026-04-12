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
    elements: [],
    selection: null,// 当前选中的元素ID，初始化为 null
    canvasConfig: {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff'
    } // 画布全局配置
  }),
  actions: {
    /**
     * 添加新元素
     */
    addElement(type, extraParams = {}) {
      const id = `${type}_${Date.now()}`; // 简单生成唯一ID
      let newElement = {
        id,
        type,
        x: 100, y: 100,
        fill: '#1890ff',
        stroke: '#000000',
        strokeWidth: 1,
        opacity: 1,
        zIndex: this.elements.length + 1,
        rotation: 0
      };
      // 针对不同类型的特有属性处理
      if (type === 'rect') {
        newElement.width = 100;
        newElement.height = 100;
      } else if (type === 'circle') {
        newElement.radius = 50;
      } else if (type === 'triangle') {
        newElement.points = [
          { x: 150, y: 50 },
          { x: 100, y: 150 },
          { x: 200, y: 150 }
        ];
      } else if (type === 'image') {
        newElement.url = extraParams.url; 
        newElement.width = extraParams.width || 200;
        newElement.height = extraParams.height || 200;
      }
      this.elements.push(newElement);
      this.selection = id; // 新增后默认选中
    },

    /**
     * 删除当前选中元素
     */
    removeSelectedElement() {
      if (!this.selection) return;
      this.elements = this.elements.filter(el => el.id !== this.selection);
      this.selection = null;
    },

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
    },

    /**
     * 从本地存储恢复数据
     */
    loadFromLocal(data) {
      if (data && data.elements) {
        this.elements = data.elements;
        this.canvasConfig = data.canvasConfig || this.canvasConfig;
      }
    }
  }
})