<template>
  <div 
    v-if="editingId" 
    class="text-editor-overlay" 
    :style="editorStyle"
    @mousedown.stop 
    @click.stop
  >
    <editor-content :editor="editor" class="tiptap-wrapper" />
  </div>
</template>

<script setup>
import { computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useText } from '../composables/useText'
import { useHistory } from '../composables/useHistory'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

const store = useCanvasStore()
const { editingId, editingText, saveText, cancelEditing, setEditor } = useText()
const { record } = useHistory()

let isReady = false

const editor = useEditor({
  content: '<p>双击编辑</p>',
  extensions: [
    StarterKit.configure({ underline: true, strike: true }),
  ],
  onUpdate: ({ editor }) => {
    if (editingId.value) {
      const el = store.elements.find(e => e.id === editingId.value)
      if (el) {
        const plainText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
        el.text = plainText
        el.richText = editor.getHTML()
        editingText.value = plainText
      }
    }
  }
})

watch(editor, (val) => {
  if (val) setEditor(val)
}, { immediate: true })

watch(editingId, async (id) => {
  if (id) {
    isReady = false
    await nextTick()
    const el = store.elements.find(e => e.id === id)
    if (editor.value && el) {
      editor.value.commands.setContent(el.richText || el.text || '<p>双击编辑</p>')
      setTimeout(() => {
        editor.value.commands.focus('end')
        setTimeout(() => { isReady = true }, 100)
      }, 50)
    }
  }
})

const editorStyle = computed(() => {
  const el = store.elements.find(e => e.id === editingId.value)
  if (!el) return { display: 'none' }

  const { offsetX, offsetY, scale } = store.viewport
  const fontSize = (el.fontSize || 20) * scale
  const boxWidth = (el.width || 200) * scale
  const boxHeight = (el.height || 40) * scale
  
  return {
    position: 'absolute',
    left: `${el.x * scale + offsetX}px`,
    top: `${el.y * scale + offsetY}px`,
    width: `${boxWidth}px`,
    minHeight: `${boxHeight}px`,
    fontSize: `${fontSize}px`,
    color: el.fill || '#000000',
    fontWeight: el.fontWeight || 'normal',
    fontFamily: el.fontFamily || 'Arial, sans-serif',
    backgroundColor: el.backgroundColor || '#00000000',
    border: el.stroke && el.strokeWidth > 0 ? `${el.strokeWidth * scale}px solid ${el.stroke}` : 'none',
    padding: `${(el.padding || 8) * scale}px`,
    zIndex: 9999,
    pointerEvents: 'auto',
    boxSizing: 'border-box'
  }
})

const finish = () => {
  if (!editingId.value) return
  const el = store.elements.find(e => e.id === editingId.value)
  if (el && editor.value) {
    const plainText = editor.value.state.doc.textBetween(0, editor.value.state.doc.content.size, '\n')
    if (!plainText || plainText.trim() === '') {
      el.text = '双击编辑'
      el.richText = '<p>双击编辑</p>'
    } else {
      el.text = plainText
      el.richText = editor.value.getHTML()
    }
  }
  record()
  saveText()
}

const cancel = () => {
  cancelEditing()
}

window.addEventListener('keydown', (e) => {
  if (!editingId.value) return
  if (e.key === 'Escape') cancel()
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    finish()
  }
})

onBeforeUnmount(() => {
  if (editor.value) editor.value.destroy()
})
</script>

<style scoped>
.text-editor-overlay {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0;
  margin: 0;
}
.tiptap-wrapper {
  width: 100%;
  height: 100%;
}
:deep(.ProseMirror) {
  width: 100%;
  min-height: 100%;
  outline: none !important;
  border: none !important;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-family: inherit;
  font-weight: inherit;
  line-height: 1.4;
  caret-color: #000000;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-word;
}
:deep(.ProseMirror p) {
  margin: 0;
}
:deep(.ProseMirror:focus) {
  background: rgba(24, 144, 255, 0.08);
  border-radius: 4px;
}
</style>