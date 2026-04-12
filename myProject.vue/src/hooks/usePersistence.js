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
      () => store.elements,
      (newElements) => {
        const dataToSave = {
          elements: newElements,
          canvasConfig: getConfig()
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
          restoreState(parsedData.elements, parsedData.canvasConfig)
        }
        console.log('[Persistence] 已恢复本地草稿')
      } catch (e) {
        console.error('[Persistence] 解析本地数据失败', e)
      }
    }
  }

  return { initAutoSave, loadLocalData }
}