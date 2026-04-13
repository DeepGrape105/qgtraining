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

  const addText = (initialText = '双击编辑') => {
    record()
    const id = generateId('text')
    store.elements.push({
      ...getBaseElement('text', id),
      text: initialText,
      fontSize: 20,
      fontWeight: 'normal'
    })
    store.selection = id
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