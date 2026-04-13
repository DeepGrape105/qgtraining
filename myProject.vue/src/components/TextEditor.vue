<template>
  <div 
    v-if="editingId" 
    class="text-editor-overlay" 
    :style="editorStyle"
    @mousedown.stop 
    @click.stop
  >
    <textarea
      ref="inputRef"
      v-model="editingText"
      @blur="onBlur"
      @keydown.enter="onEnter"
      @keydown.esc="cancel"
      @input="onInput"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useText } from '../composables/useText'
import { useHistory } from '../composables/useHistory'

const store = useCanvasStore()
const { editingId, editingText, saveText, cancelEditing } = useText()
const { record } = useHistory()
const inputRef = ref(null)

let isReady = false

watch(editingId, async (id) => {
  if (id) {
    isReady = false
    await nextTick()
    
    setTimeout(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
      setTimeout(() => { isReady = true }, 100)
    }, 50)
  }
})

const autoResize = () => {
  const el = inputRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
}

const onInput = () => {
  autoResize()
  // 实时更新画布文字
  if (editingId.value) {
    const el = store.elements.find(e => e.id === editingId.value)
    if (el) {
      el.text = editingText.value
    }
  }
}

const onBlur = () => {
  if (!isReady) return
  finish()
}

const onEnter = (e) => {
  // Shift+Enter 换行，单独 Enter 保存
  if (!e.shiftKey) {
    e.preventDefault()
    finish()
  }
}


const editorStyle = computed(() => {
  const el = store.elements.find(e => e.id === editingId.value)
  if (!el) return { display: 'none' }

  const { offsetX, offsetY, scale } = store.viewport
  const fontSize = (el.fontSize || 20) * scale
  const text = el.text || ''
  
  // 根据文字长度估算宽度
  const estimatedWidth = Math.max(text.length * fontSize * 0.6, 150)
  
  return {
    position: 'absolute',
    left: `${el.x * scale + offsetX}px`,
    top: `${el.y * scale + offsetY}px`,
    fontSize: `${fontSize}px`,
    width: `${estimatedWidth}px`,
    color: el.fill || '#000000',
    fontWeight: el.fontWeight || 'normal',
    fontFamily: 'Arial, sans-serif',
    zIndex: 9999,
    pointerEvents: 'auto'
  }
})

const finish = () => {
  if (!editingText.value || editingText.value.trim() === '') {
    editingText.value = '双击编辑'
    const el = store.elements.find(e => e.id === editingId.value)
    if (el) el.text = editingText.value
  }
  record()
  saveText()
}

const cancel = () => {
  cancelEditing()
}
</script>

<style scoped>
.text-editor-overlay {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0;
  margin: 0;
  background: transparent;
}
textarea {
  display: inline-block; 
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-family: inherit;
  font-weight: inherit;
  line-height: 1.2;
  resize: none;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
  caret-color: #007aff;
  width: 100% !important;
  min-width: 20px;
}
textarea:focus {
  background: rgba(24, 144, 255, 0.08);
  border-radius: 4px;
}
</style>