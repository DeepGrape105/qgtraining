import { onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from './useElements'
import { useHistory } from './useHistory'
import { useText } from './useText'

/**
 * useKeyboard Composable
 * 全局键盘快捷键调度器，负责处理画布的撤销、重做、剪切板操作及组合管理
 */
export function useKeyboard() {
  const store = useCanvasStore()
  const { copyElement, pasteElement, removeSelected, group, ungroup } = useElements()
  const { undo, redo } = useHistory()
  const { editingId } = useText()

  /**
   * 键盘事件核心处理器
   */
  const handleKeyDown = (e) => {
    // 【拦截策略】如果焦点处于原生输入控件中，屏蔽所有画布快捷键以免干扰文字输入
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return

    // 适配多平台（Windows: Ctrl, macOS: Command）
    const isCtrl = e.ctrlKey || e.metaKey

    // --- 历史记录管理 ---
    if (isCtrl && e.key === 'z') {
      e.preventDefault()
      undo()
    }
    if (isCtrl && e.key === 'y') {
      e.preventDefault()
      redo()
    }

    // --- 剪贴板：复制 (Copy) ---
    if (isCtrl && e.key === 'c') {
      if (editingId.value) return  // 若正在 Canvas 文字编辑模式，跳过逻辑
      e.preventDefault()

      const selectedElements = store.elements.filter(el =>
        store.selectedIds.includes(el.id)
      )

      if (selectedElements.length > 0) {
        // 【关键逻辑】利用 JSON 实现深拷贝断开响应式引用，并生成唯一的业务 ID 
        const clonedElements = selectedElements.map(el => ({
          ...JSON.parse(JSON.stringify(el)),
          id: `${el.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }))

        store.clipboard = clonedElements
      }
    }

    // --- 剪贴板：粘贴 (Paste) ---
    if (isCtrl && e.key === 'v') {
      if (editingId.value) return
      e.preventDefault()

      if (store.clipboard && store.clipboard.length > 0) {
        // 【体验优化】设置坐标偏移量 (Offset)，防止粘贴出的元素与原元素重叠，增强视觉反馈
        const offset = 20

        const newElements = store.clipboard.map(el => ({
          ...el,
          id: `${el.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: el.x + offset,
          y: el.y + offset
        }))

        store.elements.push(...newElements)
        store.selectedIds = newElements.map(el => el.id) // 自动选中新粘贴的内容
        store.clipboard = newElements  // 更新暂存区，实现连续粘贴时的阶梯式偏移
      }
    }

    // --- 剪贴板：剪切 (Cut) ---
    if (isCtrl && e.key === 'x') {
      if (editingId.value) return
      e.preventDefault()

      const selectedElements = store.elements.filter(el =>
        store.selectedIds.includes(el.id)
      )

      if (selectedElements.length > 0) {
        // 将当前选中项深度拷贝至剪贴板
        store.clipboard = selectedElements.map(el => ({
          ...JSON.parse(JSON.stringify(el))
        }))

        // 从主存储中移除原元素，并清空选中态
        store.elements = store.elements.filter(el =>
          !store.selectedIds.includes(el.id)
        )
        store.selectedIds = []
      }
    }

    // --- 元素移除 ---
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (editingId.value) return
      removeSelected()
    }

    // --- 全选 (Select All) ---
    if (isCtrl && e.key === 'a') {
      if (editingId.value) return
      e.preventDefault()
      store.selectedIds = store.elements.map(el => el.id)
    }

    // --- 组合管理 (Grouping) ---
    // Ctrl + G：将当前选中的多个元素绑定为组
    if (isCtrl && e.key === 'g' && !e.shiftKey) {
      e.preventDefault()
      group()
    }

    // Ctrl + Shift + G：拆分当前选中的组合
    if (isCtrl && e.shiftKey && e.key === 'G') {
      e.preventDefault()
      ungroup()
    }
  }

  // 组件挂载时注册全局监听
  onMounted(() => window.addEventListener('keydown', handleKeyDown))

  // 【重要】组件卸载时必须移除监听器，防止内存泄漏和逻辑冲突
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
}