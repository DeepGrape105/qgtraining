// src/hooks/usePersistence.js
import { watch } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from '../composables/useElements'

export function usePersistence() {
  const store = useCanvasStore()
  const { getConfig, restoreState } = useElements()
  const STORAGE_KEY = 'my_canvas_draft'

  const initAutoSave = () => {
    watch(
      () => [store.elements, store.canvasConfig, store.viewport],  // 监听 viewport
      ([newElements, newConfig, newViewport]) => {
        const dataToSave = {
          elements: newElements,
          canvasConfig: newConfig,
          viewport: newViewport  // 保存视口
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
      },
      { deep: true }
    )
  }

  const loadLocalData = () => {
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)
        if (parsedData) {
          restoreState(
            parsedData.elements,
            parsedData.canvasConfig,
            parsedData.viewport  // 恢复视口
          )
        }
        console.log('[Persistence] 已恢复本地草稿')
      } catch (e) {
        console.error('[Persistence] 解析本地数据失败', e)
      }
    }
  }

  return { initAutoSave, loadLocalData }
}