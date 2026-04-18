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
      <button @click="editor.chain().focus().toggleUnderline().run()" :class="{ 'is-active': editor.isActive('underline') }">下划线</button>
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
import Underline from '@tiptap/extension-underline'

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
    ,Underline
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

// 自定义全选快捷键，阻止事件冒泡
const SelectAll = Extension.create({
  name: 'selectAll',
  addKeyboardShortcuts() {
    return {
      'Mod-a': ({ editor }) => {
        editor.commands.selectAll()
        return true  // 返回 true 表示已处理，不会继续传播
      }
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            // 如果是 Ctrl+A 或 Cmd+A，阻止事件冒泡到画布
            if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
              event.stopPropagation()
              // 不阻止默认行为，让编辑器自己处理全选
            }
            return false
          }
        }
      })
    ]
  }
})
</script>

<style scoped src="../styles/richTextEditor.css"></style>