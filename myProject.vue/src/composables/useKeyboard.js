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
      if (editingId.value) return  // 编辑中不执行
      e.preventDefault()

      const selectedElements = store.elements.filter(el =>
        store.selectedIds.includes(el.id)
      )

      if (selectedElements.length > 0) {
        // 深拷贝选中元素，并生成新 ID
        const clonedElements = selectedElements.map(el => ({
          ...JSON.parse(JSON.stringify(el)),
          id: `${el.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }))

        store.clipboard = clonedElements
      }
    }
    if (isCtrl && e.key === 'v') {
      if (editingId.value) return
      e.preventDefault()

      if (store.clipboard && store.clipboard.length > 0) {
        // 计算偏移量（让粘贴的元素不覆盖原位置）
        const offset = 20

        const newElements = store.clipboard.map(el => ({
          ...el,
          id: `${el.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: el.x + offset,
          y: el.y + offset
        }))

        store.elements.push(...newElements)
        store.selectedIds = newElements.map(el => el.id)
        store.clipboard = newElements  // 更新剪贴板，方便连续粘贴
      }
    }

    // Ctrl+X：剪切
    if (isCtrl && e.key === 'x') {
      if (editingId.value) return
      e.preventDefault()

      const selectedElements = store.elements.filter(el =>
        store.selectedIds.includes(el.id)
      )

      if (selectedElements.length > 0) {
        store.clipboard = selectedElements.map(el => ({
          ...JSON.parse(JSON.stringify(el))
        }))

        // 删除原元素
        store.elements = store.elements.filter(el =>
          !store.selectedIds.includes(el.id)
        )
        store.selectedIds = []
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (editingId.value) return
      removeSelected()
    }
    if (isCtrl && e.key === 'a') {
      // 如果正在编辑文字，不执行画布全选
      if (editingId.value) return

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