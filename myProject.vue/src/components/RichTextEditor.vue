<template>
  <div 
    v-if="editingId" 
    class="click-outside-catcher" 
    @mousedown.stop.prevent="finish"
  ></div>

  <div 
    v-if="editingId" 
    class="text-editor-overlay" 
    :style="editorStyle"
    @mousedown.stop 
    @click.stop
  >
    <bubble-menu
      v-if="editor"
      :editor="editor"
      :tippy-options="{ duration: 100 }"
      class="bubble-menu"
    >
      <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'is-active': editor.isActive('bold') }">加粗</button>
      <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'is-active': editor.isActive('italic') }">斜体</button>
      <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'is-active': editor.isActive('strike') }">删除线</button>
    </bubble-menu>

    <editor-content :editor="editor" class="tiptap-wrapper" />
  </div>
</template>

<script setup>
import { computed, watch, nextTick, ref, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Extension } from '@tiptap/core'
import { useCanvasStore } from '../store/canvasStore'
import { useText } from '../composables/useText'
import { useHistory } from '../composables/useHistory'

const store = useCanvasStore()
const { editingId, editingText, saveText, cancelEditing } = useText()
const { record } = useHistory()

let isReady = false

// 自定义回车键拦截：保留你 Enter 保存，Shift+Enter 换行的习惯
const EnterShortcut = Extension.create({
  addKeyboardShortcuts() {
    return {
      'Enter': () => {
        finish()
        return true // 拦截默认回车行为
      },
      'Escape': () => {
        cancel()
        return true
      }
    }
  }
})

// 初始化 TipTap 编辑器
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    EnterShortcut // 挂载自定义快捷键
  ],
  onUpdate: ({ editor }) => {
    if (editingId.value) {
      const el = store.elements.find(e => e.id === editingId.value)
      if (el) {
        // 【关键设计】：分别保存纯文本和富文本
        // 1. 提取纯文本给 el.text，让你的 Renderer 继续完美测算高度！
        const plainText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
        el.text = plainText
        
        // 2. 提取 HTML 给 el.richText，保留加粗斜体等格式
        el.richText = editor.getHTML() 
        editingText.value = el.text // 同步原逻辑
      }
    }
  }
})

watch(editingId, async (id) => {
  if (id) {
    isReady = false
    await nextTick()
    
    const el = store.elements.find(e => e.id === id)
    if (editor.value && el) {
      // 优先加载富文本，没有的话加载纯文本
      editor.value.commands.setContent(el.richText || el.text || '')
      
      setTimeout(() => {
        // 自动聚焦并把光标移到最后
        editor.value.commands.focus('end')
        setTimeout(() => { isReady = true }, 100)
      }, 50)
    }
  }
})

// 样式与原生逻辑完全一致，保证文本框行为不被破坏
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
    height: `${boxHeight}px`,
    fontSize: `${fontSize}px`,
    color: el.fill || '#000000',
    fontWeight: el.fontWeight || 'normal',
    fontFamily: 'Arial, sans-serif',
    zIndex: 9999, // 保证在画布最上层
    pointerEvents: 'auto'
  }
})

const finish = () => {
  if (!isReady) return
  
  const el = store.elements.find(e => e.id === editingId.value)
  if (el) {
    // 没字时的默认提示
    const plainText = editor.value.getText()
    if (!plainText || plainText.trim() === '') {
      el.text = '双击编辑'
      el.richText = '<p>双击编辑</p>'
    }
  }
  record()
  saveText()
}

const cancel = () => {
  cancelEditing()
}

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})
</script>

<style scoped>
/* 终极拦截器：放在全屏幕最顶层（比编辑器低一层），吃掉所有空白处的点击 */
.click-outside-catcher {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9998; 
  cursor: default;
}

.text-editor-overlay {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0;
  margin: 0;
  background: transparent;
}

/* TipTap 编辑器核心样式 */
.tiptap-wrapper {
  width: 100%;
  height: 100%;
}

:deep(.ProseMirror) {
  width: 100%;
  height: 100%;
  outline: none !important;
  border: none !important;
  padding: 8px; /* 与你 Renderer 内置的 8px padding 完美重合 */
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

/* 去除默认段落的上下边距，保证高度测算与 Canvas 精准对齐 */
:deep(.ProseMirror p) {
  margin: 0;
}

:deep(.ProseMirror:focus) {
  background: rgba(24, 144, 255, 0.08);
  border-radius: 4px;
}

/* 悬浮菜单样式 */
.bubble-menu {
  display: flex;
  background-color: #ffffff;
  padding: 4px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
  gap: 4px;
}

.bubble-menu button {
  border: none;
  background: none;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #475569;
}

.bubble-menu button:hover {
  background-color: #f1f5f9;
}

.bubble-menu button.is-active {
  background-color: #e2e8f0;
  font-weight: bold;
  color: #0f172a;
}
</style>