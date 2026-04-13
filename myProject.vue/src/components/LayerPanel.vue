<template>
  <div class="layer-panel">
    <div class="panel-header">图层管理</div>
    <div class="layer-list">
      <div 
        v-for="el in sortedElements" 
        :key="el.id"
        class="layer-item"
        :class="{ active: selection === el.id }"
        @click="selectElement(el.id)"
      >
        <span class="el-icon">{{ getIcon(el.type) }}</span>
        <span class="el-label">{{ el.text || el.type }}</span>
        <div class="el-actions">
          <button @click.stop="toggleVisible(el.id)" :title="el.isVisible === false ? '显示' : '隐藏'">
            {{ el.isVisible === false ? '🔒' : '👁️' }}
          </button>
        </div>
      </div>
      <div v-if="elements.length === 0" class="empty-tip">暂无元素</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from '../composables/useElements'

const store = useCanvasStore()
const { setSelection, updateElement } = useElements()

const elements = computed(() => store.elements)
const selection = computed(() => store.selection)

// 按 zIndex 降序排列，顶层元素显示在最上面
const sortedElements = computed(() => {
  return [...store.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
})

const selectElement = (id) => {
  setSelection(id)
}

const toggleVisible = (id) => {
  const el = store.elements.find(e => e.id === id)
  if (el) {
    updateElement(id, { isVisible: el.isVisible === false })
  }
}

const getIcon = (type) => {
  const icons = { rect: '⬜', circle: '⭕', triangle: '🔺', text: 'T', image: '🖼️' }
  return icons[type] || '?'
}
</script>

<style scoped>
.layer-panel {
  width: 200px;
  background: white;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  z-index: 10;
}
.panel-header {
  padding: 12px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}
.layer-list {
  flex: 1;
  overflow-y: auto;
}
.layer-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}
.layer-item:hover { background: #f5faff; }
.layer-item.active { background: #e6f7ff; border-left: 3px solid #1890ff; }
.el-icon { margin-right: 8px; width: 20px; text-align: center; }
.el-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.el-actions button { background: none; border: none; cursor: pointer; opacity: 0.6; }
.el-actions button:hover { opacity: 1; }
.empty-tip { text-align: center; color: #999; margin-top: 20px; font-size: 12px; }
</style>