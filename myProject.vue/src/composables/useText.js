import { ref } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from './useElements'  
import { useHistory } from './useHistory' 

// 全局单例状态，确保同一时间只有一个文本在编辑
const editingId = ref(null)
const editingText = ref('')
const editor = ref(null)

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
      text: '双击编辑',          // Canvas 渲染用纯文本
      richText: '<p>双击编辑</p>', // TipTap 编辑器用富文本
      width: 200,
      height: 40,
      fill: '#000000',
      strokeWidth: 0,
      stroke: '#00000000'
    }
    store.elements.push(newText)
    store.selectedIds = [id]
    startEditing(id)
  }

  const setEditor = (editorInstance) => {
    editor.value = editorInstance
  }
  return {
    addText,
    editingId,
    editingText,
    startEditing,
    saveText,
    cancelEditing,
    editor,
  setEditor
  }
}