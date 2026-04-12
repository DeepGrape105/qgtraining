//本文件用于定义画布状态管理的 Pinia store
import { defineStore } from 'pinia'

/**
 * 画布状态存储
 * 里面包含元素列表、选中的元素、画布配置等状态，以及一些用于批量设置元素和配置的 actions，方便在持久化恢复时使用
 */
export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    elements: [],//画布里的所有元素
    selection: null,//当前选中的元素
    canvasConfig: {
      showGrid: true,        // 是否显示网格
      gridSize: 30,          // 网格大小     
      backgroundColor: '#ffffff'
    },//画布配置
    viewport: {
      offsetX: 0,    // X 方向偏移
      offsetY: 0,    // Y 方向偏移
      scale: 1       // 缩放比例
    }//画布视口
  })
})