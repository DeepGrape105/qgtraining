import { onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from './useElements'
import { useHistory } from './useHistory'
import { useText } from './useText'

export function useKeyboard() {
  const store = useCanvasStore()
  const { copyElement, pasteElement, removeSelected, group, ungroup } = useElements()
  const { undo, redo } = useHistory()
  const { editingId } = useText()

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
      if (editingId.value) return
      removeSelected()
    }
    if (isCtrl && e.key === 'a') {
      e.preventDefault()
      store.selectedIds = store.elements.map(el => el.id)
    }
    // 🌟 Ctrl + G：打组
    if (isCtrl && e.key === 'g' && !e.shiftKey) {
      e.preventDefault()
      group()
    }

    // 🌟 Ctrl + Shift + G：解组
    if (isCtrl && e.shiftKey && e.key === 'G') {
      e.preventDefault()
      ungroup()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
}