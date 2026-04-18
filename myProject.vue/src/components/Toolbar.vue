<template>
  <div class="toolbar">
    <div class="tool-group">
      <button class="tool-btn" @click="addRect">矩形</button>
      <button class="tool-btn" @click="addCircle">圆形</button>
      <button class="tool-btn" @click="addTriangle">三角形</button>
       <button class="tool-btn" @click="addText">📝文本</button> 
      <button 
        class="tool-btn upload-btn" 
        @click="triggerUpload" 
        :disabled="isUploading"
      >
        <span class="icon">🖼️</span>
        {{ isUploading ? '上传中...' : '插入图片' }}
      </button>
      <input 
        type="file" 
        ref="fileInputRef" 
        accept="image/png, image/jpeg" 
        style="display: none" 
        @change="handleFileUpload" 
      />
    </div>

    <div class="divider"></div>

   <div class="tool-group" v-if="selectedEl">
  <!-- 只显示颜色选择器（非图片） -->
  <template v-if="selectedEl.type !== 'image'">
    <div class="color-picker-wrapper">
      <label>填充：</label>
      <input 
        type="color" 
        :value="selectedEl.fill || '#000000'" 
        @input="e => updateElementFill(e.target.value)" 
      />
    </div>
  </template>
  
  </div>
 <!-- 🌟 中间区域：根据选中数量显示不同内容 -->
    <div class="tool-group">
      <!-- 单选：显示颜色选择器和删除 -->
      <template v-if="selectedCount === 1 && selectedEl">
        <button class="tool-btn delete-btn" @click="removeSelected">删除</button>
      </template>
      
      <!-- 🌟 多选：显示打组和解组 -->
      <template v-else-if="selectedCount > 1">
        <button class="tool-btn" @click="group">📁 打组</button>
        <button class="tool-btn" @click="ungroup">📂 解组</button>
        <button class="tool-btn delete-btn" @click="removeSelected">删除</button>
      </template>
      
      <!-- 未选中：显示提示 -->
      <template v-else>
        <div class="hint">未选中元素</div>
      </template>
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <button class="tool-btn save-btn" @click="saveToServer" :disabled="isSaving">
        <span class="icon">☁️</span>
        {{ isSaving ? '同步中...' : '存云端' }}
      </button>
      
      <select v-model="selectedHistory" @change="loadHistory" class="history-select">
        <option value="">查看历史版本</option>
        <option v-for="item in historyList" :key="item.id" :value="item.id">
          版本 {{ item.id }} ({{ new Date(item.created_at).toLocaleTimeString() }})
        </option>
      </select>
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <button class="tool-btn export-btn" @click="exportToImage">
        <span class="icon">⬇️</span> 导出为 PNG
      </button>
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <button class="tool-btn" @click="toggleGrid">{{ store.canvasConfig.showGrid ? '▦' : '□' }}</button>
    </div>
  </div>
</template>

<script setup>
/**
 * @file Toolbar.vue
 * @description 画布顶部悬浮工具栏组件，提供元素操作、属性修改、云端同步及状态导出能力。
 */

import { ref, computed, onMounted, nextTick } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from '../composables/useElements'
import { saveCanvasApi, getHistoryListApi, getSnapshotDataApi } from '../api/canvas'
import { uploadImageApi } from '../api/upload'
import { useViewport } from '../composables/useViewport'
import{ useHistory } from '../composables/useHistory'
import { useText } from '../composables/useText'


const store = useCanvasStore()
const { getViewport, resetViewport, zoomIn, zoomOut } = useViewport()
const viewport = computed(() => getViewport())
const { record } = useHistory()
const {addText} = useText()
const { 
  addRect, addCircle, addTriangle, addImage, 
  removeSelected, updateSelected,
  setElements, getElements, getConfig, clearSelection,
  group, ungroup 
} = useElements()


// UI 交互状态
const isSaving = ref(false);
const isUploading = ref(false);
const fileInputRef = ref(null);

// 快照数据状态
const historyList = ref([]);
const selectedHistory = ref('');

// 当前选中元素响应式引用
const selectedEl = computed(() => {
  const ids = store.selectedIds
  if (ids.length !== 1) return null  // 多选或没选时返回 null
  return store.elements.find(el => el.id === ids[0])
})

const selectedCount = computed(() => store.selectedIds.length)

/**
 * 更新选中元素的填充颜色
 * @param {string} color - Hex 颜色值
 */
const updateElementFill = (color) => {
  record() 
  updateSelected({ fill: color })
}

/**
 * 唤起系统文件选择对话框
 */
const triggerUpload = () => {
  if (fileInputRef.value) fileInputRef.value.click();
};

/**
 * 处理文件上传及图片元素实例化
 * @param {Event} e - Input change 事件对象
 */
const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  isUploading.value = true;
  try {
    const url = await uploadImageApi(file);
    
    // 利用 Image 对象预加载以获取真实分辨率
    const img = new Image();
    img.src = url;
    img.onload = () => {
      addImage(url, img.width, img.height)
    };
  } catch (error) {
    console.error('[Toolbar] Image upload failed:', error);
  } finally {
    isUploading.value = false;
    e.target.value = ''; // 重置 input state
  }
};

/**
 * 获取云端历史快照列表
 */
const fetchHistory = async () => {
  try {
    const res = await getHistoryListApi('1');
    historyList.value = res || [];
  } catch (error) {
    console.error('[Toolbar] Fetch history failed:', error);
  }
};

/**
 * 将当前画布状态持久化至云端
 */
const saveToServer = async () => {
  const elements = getElements()
  if (elements.length === 0) return alert('画布为空，无需保存')
  
  isSaving.value = true
  try {
    const pureElements = JSON.parse(JSON.stringify(elements))
    const pureConfig = JSON.parse(JSON.stringify(getConfig()))
    
    await saveCanvasApi('1', pureElements, pureConfig)
    localStorage.removeItem('canvas_draft_data')
    await fetchHistory()
    alert('同步成功')
  } catch (error) {
    console.error('[Toolbar] Save canvas failed:', error)
  } finally {
    isSaving.value = false
  }
}

/**
 * 执行画布状态回滚
 */
const loadHistory = async () => {
  if (!selectedHistory.value) return;
  
  if (!confirm('确定回滚至该版本？当前未保存的修改将丢失。')) {
    selectedHistory.value = ''; 
    return;
  }

  try {
    const elementsData = await getSnapshotDataApi('1', selectedHistory.value);
    setElements(elementsData)
  } catch (error) {
    console.error('[Toolbar] Rollback failed:', error);
  } finally {
    selectedHistory.value = '';
  }
};

/**
 * 将当前 Canvas 视图导出为 PNG 图片
 * @notice 依赖所有跨域图片资源的 CORS 配置 (crossOrigin="anonymous")
 */
const exportToImage = async () => {
  // 1. 清除交互态 (如选中高亮边框)
  clearSelection()

  // 2. 等待 Vue 重新渲染 DOM
  await nextTick(); 
  
  const canvasEl = document.querySelector('canvas');
  if (!canvasEl) return;
  
  try {
    const dataUrl = canvasEl.toDataURL('image/png', 1.0); 
    const link = document.createElement('a');
    link.download = `export_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('[Toolbar] Export failed. Check CORS policy:', error);
    alert('导出失败，请检查控制台跨域拦截信息。');
  }
};

const handleZoomIn = () => {
  const centerX = store.canvasConfig.width / 2
  const centerY = store.canvasConfig.height / 2
  zoomIn(centerX, centerY)
}

const handleZoomOut = () => {
  const centerX = store.canvasConfig.width / 2
  const centerY = store.canvasConfig.height / 2
  zoomOut(centerX, centerY)
}

onMounted(() => {
  fetchHistory();
})

const toggleGrid = () => {
  store.canvasConfig.showGrid = !store.canvasConfig.showGrid
}

</script>

<style scoped src="../styles/toolbar.css"></style>
