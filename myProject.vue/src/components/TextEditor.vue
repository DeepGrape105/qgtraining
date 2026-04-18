<template>
  <div v-if="editingId" class="text-editor-overlay" :style="editorStyle" ref="editorContainerRef">
    <div class="editor-container" @mousedown.stop>
      <editor-content :editor="editor" class="tiptap-wrapper" />
    </div>
  </div>
</template>

<script setup>
import { computed, watch, nextTick, onBeforeUnmount, ref, onMounted } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useText } from '../composables/useText'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'

/**
 * 状态与组合式 API 引用
 */
const store = useCanvasStore()
const { setEditor, updateActiveStyles, editingId, saveText } = useText()

// 状态锁：标志编辑器是否完成内容初始化和聚焦，防止初始化期间触发错误的同步逻辑
const isReady = ref(false)
// 状态锁：标志当前更新是否源自 Store 属性面板，防止产生死循环更新 (Store <-> Editor)
const isUpdatingFromStore = ref(false)
const editorContainerRef = ref(null)

/**
 * 处理“点击外部”逻辑
 * 实现点击非编辑器区域且非右侧属性面板时，自动保存并退出编辑模式
 * 使用 capture: true (事件捕获) 确保在其他业务逻辑触发前拦截
 */
const handleOutsideClick = (e) => {
  if (editingId.value && editorContainerRef.value) {
    const sidebar = document.querySelector('.right-sidebar')
    // 如果点击的是属性面板，允许操作而不关闭编辑器
    if (sidebar && sidebar.contains(e.target)) return 
    // 如果点击既不在编辑器内也不在面板内，则触发保存
    if (!editorContainerRef.value.contains(e.target)) saveText()
  }
}

/**
 * 组件生命周期钩子
 */
onMounted(() => window.addEventListener('mousedown', handleOutsideClick, true))
onBeforeUnmount(() => {
  // 必须移除全局监听，防止内存泄漏和意外逻辑触发
  window.removeEventListener('mousedown', handleOutsideClick, true)
  // 销毁编辑器实例释放内存
  if (editor.value) editor.value.destroy()
})

/**
 * Tiptap 编辑器核心配置
 */
const editor = useEditor({
  extensions: [
    StarterKit, 
    Underline, 
    TextStyle, 
    Color, 
    Bold, 
    Italic,
    Highlight.configure({
      multicolor: true, 
      HTMLAttributes: {
        class: 'highlight',
      },
    }),
  ],
  // 当编辑器内容发生变化时的回调
  onUpdate: ({ editor }) => {
    // 如果是由于外部 Store 导致的变化或是还没准备好，则不反馈给 Store
    if (isUpdatingFromStore.value || !isReady.value) return
    
    const el = store.elements.find(e => e.id === editingId.value)
    if (el) {
      // 同时同步富文本 HTML 和用于搜索/预览的纯文本
      el.richText = editor.getHTML()
      el.text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
      
      // 文字编辑时动态调整高度，设为 0 是为了触发布局引擎重新计算高度
      el.height = 0  
      // 触发 Store 的响应式更新
      store.elements = [...store.elements]
    }
  },
  // 当光标选择区域变化时，更新工具栏的“激活状态”（如加粗按钮的高亮）
  onSelectionUpdate: ({ editor }) => {
    if (!isReady.value) return
    updateActiveStyles({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike')
    })
  }
})

// 将 editor 实例暴露给全局 Text 状态管理，以便从 Sidebar 等组件调用命令
watch(editor, (val) => { if (val) setEditor(val) }, { immediate: true })

/**
 * 监听器：从 Store 到编辑器的单向数据同步
 * 当用户在属性面板修改颜色、字号或通过撤销重做改变了 HTML 时，更新编辑器
 */
watch(
  () => {
    const el = store.elements.find(e => e.id === editingId.value)
    if (!el) return null
    // 序列化关键属性，仅当这些属性变化时才触发监听
    return JSON.stringify({ html: el.richText, fill: el.fill, size: el.fontSize, font: el.fontFamily })
  },
  () => {
    if (!editor.value || !editingId.value || !isReady.value) return
    const el = store.elements.find(e => e.id === editingId.value)
    if (!el) return
    
    // 只有当编辑器内容与数据源不一致时才 setContent，避免重复渲染造成的光标跳动
    if (el.richText !== editor.value.getHTML()) {
      isUpdatingFromStore.value = true
      editor.value.commands.setContent(el.richText || '', false)
      nextTick(() => { isUpdatingFromStore.value = false })
    }
  }
)

/**
 * 监听编辑 ID 切换
 * 当双击某个文字进入编辑时，初始化编辑器内容、聚焦并设置光标
 */
watch(editingId, async (id) => {
  if (id) {
    isReady.value = false
    const el = store.elements.find(e => e.id === id)
    if (editor.value && el) {
      // 载入数据：富文本优先，纯文本次之
      editor.value.commands.setContent(el.richText || el.text || '')
      await nextTick()
      // 延迟聚焦，确保 DOM 已经根据 editorStyle 计算到位
      setTimeout(() => { 
        editor.value.commands.focus('end')
        isReady.value = true 
      }, 50)
    }
  }
})

/**
 * 计算属性：编辑器层的位置样式
 * 将 Canvas 的坐标系转换为网页的 Absolute 坐标系
 * 计算公式：(画布坐标 + 内边距) * 缩放比例 + 视口偏移量
 */
const editorStyle = computed(() => {
  const el = store.elements.find(e => e.id === editingId.value)
  if (!el) return { display: 'none' }
  
  const { offsetX, offsetY, scale } = store.viewport
  const p = el.padding || 8 // 编辑时的文字内边距偏移

  return {
    position: 'absolute',
    // 核心转换逻辑：将 Canvas 内的坐标投影到屏幕 absolute 定位上
    left: `${(el.x + p) * scale + offsetX}px`,
    top: `${(el.y + p) * scale + offsetY}px`,
    width: `${(el.width - p * 2) * scale}px`,
    minHeight: `${(el.height - p * 2) * scale}px`,
    fontSize: `${(el.fontSize || 20) * scale}px`,
    color: el.fill || '#000000',
    fontFamily: el.fontFamily || 'Arial, sans-serif',
    lineHeight: '1.4', 
    zIndex: 10000,
    boxSizing: 'border-box',
    outline: 'none',
    pointerEvents: 'auto' // 确保在 overlay 上能正常交互
  }
})
</script>

<style scoped src="../styles/textEditor.css"></style>