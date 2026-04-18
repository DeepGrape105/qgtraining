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
/**
 * TextEditor 组件
 * 功能：提供图形上方的富文本实时编辑层，支持样式切换、自动定位及历史记录回退。
 */
import { computed, watch, nextTick, onBeforeUnmount } from 'vue'
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

// 状态锁：防止在编辑器初始化过程中误触发 finish 导致保存错误
let isReady = false

/**
 * 自定义 Tiptap 扩展：键盘快捷键
 * Enter: 结束编辑并保存
 * Escape: 取消编辑并回滚
 */
const EnterShortcut = Extension.create({
  addKeyboardShortcuts() {
    return {
      'Enter': () => {
        finish()
        return true
      },
      'Escape': () => {
        cancel()
        return true
      }
    }
  }
})

/**
 * 初始化 Tiptap 编辑器实例
 */
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,      // 基础套件（包含段落、列表、粗体等）
    EnterShortcut,   // 自定义快捷键
    Underline        // 下划线插件
  ],
  // 实时更新：当编辑器内容改变时，将数据同步回 Store 中的元素对象
  onUpdate: ({ editor }) => {
    if (editingId.value) {
      const el = store.elements.find(e => e.id === editingId.value)
      if (el) {
        // 1. 提取纯文本用于画布渲染引擎绘制（非编辑状态下使用）
        const plainText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
        el.text = plainText
        
        // 2. 存储 HTML 富文本字符串，用于下次进入编辑状态时恢复样式
        el.richText = editor.getHTML() 
        editingText.value = el.text 
      }
    }
  }
})

/**
 * 监听编辑对象变化
 * 当 editingId 改变时，更新编辑器内容并自动聚焦
 */
watch(editingId, async (id) => {
  if (id) {
    isReady = false
    await nextTick()
    
    const el = store.elements.find(e => e.id === id)
    if (editor.value && el) {
      // 优先级：富文本数据 > 纯文本数据 > 空字符串
      editor.value.commands.setContent(el.richText || el.text || '')
      
      // 延迟处理：确保 DOM 渲染后聚焦并设置光标在末尾
      setTimeout(() => {
        editor.value.commands.focus('end')
        // 标记准备就绪，此时点击外部可以触发保存
        setTimeout(() => { isReady = true }, 100)
      }, 50)
    }
  }
})

/**
 * 核心坐标计算逻辑
 * 将画布坐标系（Canvas Space）中的图形坐标转换为网页 DOM 坐标系（Screen Space）
 * 计算公式：屏幕位置 = (元素坐标 * 缩放比例) + 视口偏移量
 */
const editorStyle = computed(() => {
  const el = store.elements.find(e => e.id === editingId.value)
  if (!el) return { display: 'none' }

  const { offsetX, offsetY, scale } = store.viewport
  // 字体大小和盒子尺寸也需要根据缩放比例进行同步
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
    zIndex: 9999,
    pointerEvents: 'auto'
  }
})

/**
 * 完成编辑
 * 1. 检查是否有空内容并进行默认值填充
 * 2. 触发历史记录（用于撤销）
 * 3. 释放编辑锁，关闭编辑器
 */
const finish = () => {
  if (!isReady) return
  
  const el = store.elements.find(e => e.id === editingId.value)
  if (el) {
    const plainText = editor.value.getText()
    // 防止用户删空内容导致图形在画布上无法点击，设置默认提示语
    if (!plainText || plainText.trim() === '') {
      el.text = '双击编辑'
      el.richText = '<p>双击编辑</p>'
    }
  }
  record()   // 记录快照，以便后续可以 Undo
  saveText() // 重置 editingId，关闭组件
}

/**
 * 取消编辑：不保存任何更改并重置状态
 */
const cancel = () => {
  cancelEditing()
}

/**
 * 内存清理：组件卸载前彻底销毁编辑器实例，防止内存泄漏
 */
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})
</script>

<style scoped src="../styles/richTextEditor.css"></style>