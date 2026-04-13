import { useCanvasStore } from '../store/canvasStore'

export function useHistory() {
  const store = useCanvasStore()

  const record = () => {
    // 限制栈深度
    if (store.history.length > 50) store.history.shift()
    // 存入快照
    store.history.push(JSON.stringify(store.elements))
    // 产生新分支，清空未来栈
    store.future = []
  }

  const undo = () => {
    if (store.history.length === 0) return
    store.future.push(JSON.stringify(store.elements))
    store.elements = JSON.parse(store.history.pop())
    store.selection = null
  }

  const redo = () => {
    if (store.future.length === 0) return
    store.history.push(JSON.stringify(store.elements))
    store.elements = JSON.parse(store.future.pop())
    store.selection = null
  }

  return { record, undo, redo }
}