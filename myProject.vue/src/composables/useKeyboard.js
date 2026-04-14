import { onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from './useElements'
import { useHistory } from './useHistory'

export function useKeyboard() {
  const store = useCanvasStore()
  const { copyElement, pasteElement, removeSelected } = useElements()
  const { undo, redo } = useHistory()

  const handleKeyDown = (e) => {
    // 如果用户正在输入框编辑，禁用快捷键
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return

    const isCtrl = e.ctrlKey || e.metaKey

    if (isCtrl && e.key === 'z') {
      e.preventDefault()
      undo()
    }
    if (isCtrl && e.key === 'y') {
      e.preventDefault()
      redo()
    }
    if (isCtrl && e.key === 'c') {
      copyElement()
    }
    if (isCtrl && e.key === 'v') {
      pasteElement()
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeSelected()
    }
    if (isCtrl && e.key === 'a') {
      e.preventDefault()
      store.selectedIds = store.elements.map(el => el.id)
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
}