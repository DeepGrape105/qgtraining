<template>
  <div class="toolbar">
    <div class="group">
  <button @click="triggerUpload">🖼️ 插入图片</button>
  <input 
    type="file" 
    ref="fileInput" 
    accept="image/png,image/jpeg" 
    style="display: none" 
    @change="handleFileUpload"
  />
</div>
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
    <div class="tool-group">
      <button class="btn-save" @click="saveToServer" :disabled="isSaving">
        {{ isSaving ? '保存中...' : '保存到云端' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useCanvasStore } from '../store/canvasStore';
import { saveCanvasApi } from '../api/canvas'; 
import { uploadImageApi } from '../api/upload'

const store = useCanvasStore();
const isSaving = ref(false);
const fileInput = ref(null)

// 获取当前选中的元素对象
const selectedElement = computed(() => 
  store.elements.find(el => el.id === store.selection)
);

const updateColor = (color) => {
  if (store.selection) {
    store.updateElement(store.selection, { fill: color });
  }
};

// 云端保存函数
const saveToServer = async () => {
  if (store.elements.length === 0) return alert('画布为空，无需保存');
  
  isSaving.value = true;
  try {
    // 假设当前操作的画布 ID 为 '1'
    const res = await saveCanvasApi('1', store.elements, store.canvasConfig);
    
    // 保存成功后，清空本地暂存
    localStorage.removeItem('canvas_draft_data');
    alert(`保存成功！快照版本号: ${res.snapshotId}`);
  } catch (error) {
    console.error('云端保存失败', error);
  } finally {
    isSaving.value = false;
  }
};

const triggerUpload = () => fileInput.value.click()
const handleFileUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const url = await uploadImageApi(file)
    
    const img = new Image()
    img.src = url
    img.onload = () => {
      store.addElement('image', {
        url,
        width: img.width,
        height: img.height
      })
    }
  } catch (error) {
    console.error('图片上传失败', error)
    alert('图片上传失败，请重试')
  }
}
</script>

<style scoped>
btn-save {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
  font-weight: bold;
}
.btn-save:hover {
  background: #40a9ff;
}
.btn-save:disabled {
  background: #d9d9d9;
  border-color: #d9d9d9;
  cursor: not-allowed;
}
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