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
import Color from '@tiptap/extension-color'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'

const store = useCanvasStore()
const { setEditor, updateActiveStyles, editingId, saveText } = useText()

const isReady = ref(false)
const isUpdatingFromStore = ref(false)
const editorContainerRef = ref(null)

const handleOutsideClick = (e) => {
  if (editingId.value && editorContainerRef.value) {
    const sidebar = document.querySelector('.right-sidebar')
    if (sidebar && sidebar.contains(e.target)) return 
    if (!editorContainerRef.value.contains(e.target)) saveText()
  }
}

onMounted(() => window.addEventListener('mousedown', handleOutsideClick, true))
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleOutsideClick, true)
  if (editor.value) editor.value.destroy()
})

const editor = useEditor({
  extensions: [StarterKit, Underline, TextStyle, Color, Bold, Italic],
  onUpdate: ({ editor }) => {
  if (isUpdatingFromStore.value || !isReady.value) return
  const el = store.elements.find(e => e.id === editingId.value)
  if (el) {
    el.richText = editor.getHTML()
    el.text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
    
    // 🌟🌟🌟 只加这一行 🌟🌟🌟
    el.height = 0  // 强制让 drawText 重新计算
    store.elements = [...store.elements]
  }
},
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

watch(editor, (val) => { if (val) setEditor(val) }, { immediate: true })

// 监听属性面板（如字号、颜色）同步到编辑器
watch(
  () => {
    const el = store.elements.find(e => e.id === editingId.value)
    if (!el) return null
    return JSON.stringify({ html: el.richText, fill: el.fill, size: el.fontSize, font: el.fontFamily })
  },
  () => {
    if (!editor.value || !editingId.value || !isReady.value) return
    const el = store.elements.find(e => e.id === editingId.value)
    if (!el) return
    if (el.richText !== editor.value.getHTML()) {
      isUpdatingFromStore.value = true
      editor.value.commands.setContent(el.richText || '', false)
      nextTick(() => { isUpdatingFromStore.value = false })
    }
  }
)

watch(editingId, async (id) => {
  if (id) {
    isReady.value = false
    const el = store.elements.find(e => e.id === id)
    if (editor.value && el) {
      editor.value.commands.setContent(el.richText || el.text || '')
      await nextTick()
      setTimeout(() => { editor.value.commands.focus('end'); isReady.value = true }, 50)
    }
  }
})

const editorStyle = computed(() => {
  const el = store.elements.find(e => e.id === editingId.value)
  if (!el) return { display: 'none' }
  const { offsetX, offsetY, scale } = store.viewport
  const p = el.padding || 8
  return {
    position: 'absolute',
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
    pointerEvents: 'auto'
    // 🌟 重点：删除了 fontWeight 和 fontStyle，让 TipTap 内部标签自己控制
  }
})
</script>

<style scoped>
.text-editor-overlay { background: transparent; }
:deep(.ProseMirror) {
  outline: none !important;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.4 !important;
  color: inherit; /* 允许继承容器颜色 */
}
:deep(.ProseMirror p) { margin: 0 !important; }

/* 🌟 样式强制叠加补丁 🌟 */
:deep(.ProseMirror strong) { font-weight: bold !important; display: inline; }
:deep(.ProseMirror em) { font-style: italic !important; display: inline; }
:deep(.ProseMirror u) { text-decoration: underline !important; display: inline; }
:deep(.ProseMirror s) { text-decoration: line-through !important; display: inline; }
</style>