import { ref } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from './useElements'  
import { useHistory } from './useHistory' 

// 全局单例状态，确保同一时间只有一个文本在编辑
const editingId = ref(null)
const editingText = ref('')

export function useText() {
  const store = useCanvasStore()
  const { record } = useHistory()  
  const { generateId, getBaseElement } = useElements() 

  /**
   * 进入编辑模式
   */
  const startEditing = (id) => {
    const el = store.elements.find(e => e.id === id)
    if (el && el.type === 'text') {
      editingId.value = id
      editingText.value = el.text || ''
    } else {
    }
  }

  /**
   * 保存并退出
   */
  const saveText = () => {
    if (!editingId.value) return
    const el = store.elements.find(e => e.id === editingId.value)
    if (el) {
      el.text = editingText.value
    }
    editingId.value = null
  }

  /**
   * 取消编辑
   */
  const cancelEditing = () => {
    editingId.value = null
  }

  // src/composables/useText.js

  const addText = () => {
    record()
    const id = generateId('text')
    const newText = {
      ...getBaseElement('text', id),
      text: '',
      width: 200,
      height: 40,
      fill: '#000000',
      strokeWidth: 0,        // 默认无边框
      stroke: 'transparent'  // 边框透明
    }
    store.elements.push(newText)
    store.selectedIds = [id]
    startEditing(id)
  }

  return {
    addText,
    editingId,
    editingText,
    startEditing,
    saveText,
    cancelEditing
  }
}