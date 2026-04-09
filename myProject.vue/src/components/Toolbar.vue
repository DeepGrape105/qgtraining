<template>
  <div class="toolbar">
    <div class="group">
      <button @click="store.addElement('rect')">矩形</button>
      <button @click="store.addElement('circle')">圆形</button>
      <button @click="store.addElement('triangle')">三角形</button>
    </div>

    <div class="divider"></div>

    <div class="group" v-if="selectedElement">
      <label>填充色:</label>
      <input 
        type="color" 
        :value="selectedElement.fill" 
        @input="e => updateColor(e.target.value)"
      />
      <button class="btn-delete" @click="store.removeSelectedElement">删除</button>
    </div>
    
    <div class="group" v-else>
      <span class="hint">未选中元素</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCanvasStore } from '../store/canvasStore';

const store = useCanvasStore();

// 获取当前选中的元素对象
const selectedElement = computed(() => 
  store.elements.find(el => el.id === store.selection)
);

const updateColor = (color) => {
  if (store.selection) {
    store.updateElement(store.selection, { fill: color });
  }
};
</script>

<style scoped>
.toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  background: white;
  padding: 10px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 15px;
  z-index: 100;
}
.group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.divider {
  width: 1px;
  height: 24px;
  background: #eee;
}
button {
  padding: 5px 12px;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 4px;
}
button:hover {
  border-color: #1890ff;
  color: #1890ff;
}
.btn-delete {
  background: #fff1f0;
  border-color: #ffa39e;
  color: #cf1322;
}
.btn-delete:hover {
  background: #cf1322;
  color: white;
  border-color: #cf1322;
}
.hint {
  color: #999;
  font-size: 12px;
}
</style>