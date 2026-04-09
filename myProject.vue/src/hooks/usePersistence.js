import { watch, onMounted } from 'vue';
import { useCanvasStore } from '../store/canvasStore';

export function usePersistence() {
  const store = useCanvasStore();
  const STORAGE_KEY = 'my_canvas_draft';

  /**
   * 自动保存逻辑：监听 elements 的深层变化
   */
  const initAutoSave = () => {
    // 监听 store.elements 的变化，任何元素属性的改变都会触发保存
    watch(
      () => store.elements,
      (newElements) => {
        const dataToSave = {
          elements: newElements,
          canvasConfig: store.canvasConfig
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        // console.log('[Persistence] 自动保存成功');
      },
      { deep: true }
    );
  };

  /**
   * 初始化加载
   */
  const loadLocalData = () => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        store.loadFromLocal(parsedData);
        console.log('[Persistence] 已恢复本地草稿');
      } catch (e) {
        console.error('[Persistence] 解析本地数据失败', e);
      }
    }
  };

  return { initAutoSave, loadLocalData };
}