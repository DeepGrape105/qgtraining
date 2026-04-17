import { defineStore } from 'pinia'

/**
 * 画布状态存储
 * 里面包含元素列表、选中的元素、画布配置等状态，以及一些用于批量设置元素和配置的 actions，方便在持久化恢复时使用
 */
export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    elements: [],//画布里的所有元素
    selectedIds: [],//当前选中的元素
    groups: {},  // 🌟 { groupId: { name: '组合1', expanded: true } }
    canvasConfig: {
      showGrid: true,        // 是否显示网格
      gridSize: 30,          // 网格大小     
      backgroundColor: '#ffffff'
    },//画布配置
    viewport: {
      offsetX: 0,    // X 方向偏移
      offsetY: 0,    // Y 方向偏移
      scale: 1       // 缩放比例
    },//画布视口
    history: [],      // 撤销栈 
    future: [],       // 重做栈
    clipboard: null, // 复制的元素数据
    marqueeRect: null
  }),
  getters: {
    selection: (state) => state.selectedIds[0] || null 
  }
})