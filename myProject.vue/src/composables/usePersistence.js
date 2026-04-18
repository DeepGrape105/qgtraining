// src/hooks/usePersistence.js
import { watch } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from './useElements'

/**
 * usePersistence Hook
 * * 职责：
 * 1. 状态持久化：利用浏览器 LocalStorage 实现画布状态的本地备份。
 * 2. 自动响应同步：通过监听 Store 变化，实时更新本地序列化快照。
 * 3. 故障容错：在应用初始化时执行数据恢复，确保用户创作内容的连续性。
 */
export function usePersistence() {
  const store = useCanvasStore()
  const { getConfig, restoreState } = useElements()
  const STORAGE_KEY = 'my_canvas_draft' // 本地存储的命名空间唯一标识

  /**
   * 初始化自动保存逻辑
   * 采用深度监听策略，捕捉画布核心要素（元素树、全局配置、视口状态）的任何变动。
   */
  const initAutoSave = () => {
    watch(
      // 聚合监听目标：当元素集合、画布参数或视口偏移发生变化时触发回调
      () => [store.elements, store.canvasConfig, store.viewport],
      ([newElements, newConfig, newViewport]) => {
        // 构建持久化数据模型
        const dataToSave = {
          elements: newElements,
          canvasConfig: newConfig,
          viewport: newViewport  // 存储当前视口位置，实现跨会话的视觉连续性
        }
        // 执行序列化并持久化至 localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
      },
      // 必须开启 deep，以递归检测对象内部属性（如元素坐标、缩放比等）的微小变化
      { deep: true }
    )
  }

  /**
   * 加载本地缓存数据
   * 在系统冷启动或页面刷新时调用，尝试还原上一次保存的创作环境。
   */
  const loadLocalData = () => {
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (savedData) {
      try {
        // 健壮性检查：对解析过程进行异常捕获，防止脏数据导致应用崩溃
        const parsedData = JSON.parse(savedData)
        if (parsedData) {
          // 调用 Elements 引擎的恢复接口，将数据重新灌入响应式系统
          restoreState(
            parsedData.elements,
            parsedData.canvasConfig,
            parsedData.viewport  // 恢复之前的偏移量与缩放比
          )
        }
        console.log('[Persistence] 已恢复本地草稿')
      } catch (e) {
        // 典型的 JSON 解析异常处理
        console.error('[Persistence] 解析本地数据失败', e)
      }
    }
  }

  return { initAutoSave, loadLocalData }
}