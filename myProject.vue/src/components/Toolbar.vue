<template>
  <div class="toolbar">
    <div class="tool-group">
      <span class="hint">␣ 按住空格拖拽画布</span>
    </div>
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
  
  <button class="tool-btn delete-btn" @click="removeSelected">删除</button>
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
      <button class="tool-btn" @click="handleZoomIn">➕</button>
      <span class="zoom-indicator">{{ Math.round(viewport.scale * 100) }}%</span>
      <button class="tool-btn" @click="handleZoomOut">➖</button>
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

const handleResetView = () => {
  resetViewport()
}

onMounted(() => {
  fetchHistory();
})

const toggleGrid = () => {
  store.canvasConfig.showGrid = !store.canvasConfig.showGrid
}

// 切换灰度
const toggleGrayscale = () => {
  if (!selectedEl.value || selectedEl.value.type !== 'image') return
  record()
  const newVal = !selectedEl.value.filters?.grayscale
  updateSelected({ filters: { ...selectedEl.value.filters, grayscale: newVal } })
}

// 更新亮度
const updateBrightness = (val) => {
  if (!selectedEl.value || selectedEl.value.type !== 'image') return
  record()
  updateSelected({ filters: { ...selectedEl.value.filters, brightness: Number(val) } })
}

// 更新对比度
const updateContrast = (val) => {
  if (!selectedEl.value || selectedEl.value.type !== 'image') return
  record()
  updateSelected({ filters: { ...selectedEl.value.filters, contrast: Number(val) } })
}
</script>

<style scoped>
/* 悬浮工具栏主容器 */
.toolbar {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(8px);
  padding: 8px 16px;
  border-radius: 40px;           /* 圆润胶囊造型 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
  user-select: none;
}

/* 分隔线 - 更精致 */
.divider {
  width: 1px;
  height: 20px;
  background: #e2e8f0;
}

/* 工具组容器 */
.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 通用按钮基础样式 - 控制高度和宽度 */
.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 14px;              /* 上下6px，左右14px */
  height: 34px;                   /* 固定高度，更整齐 */
  min-width: 64px;                /* 最小宽度，避免太窄 */
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 30px;            /* 圆角按钮 */
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;            /* 文字不换行 */
}

.tool-btn:hover:not(:disabled) {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.tool-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 图标与文字间距 */
.tool-btn .icon {
  font-size: 14px;
}

/* 删除按钮 */
.delete-btn {
  color: #ef4444;
  background: #fef2f2;
  border-color: #fecaca;
}
.delete-btn:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
}

/* 保存按钮 */
.save-btn {
  color: #ffffff;
  background: #3b82f6;
  border-color: #3b82f6;
}
.save-btn:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

/* 导出按钮 */
.export-btn {
  color: #059669;
  background: #ecfdf5;
  border-color: #a7f3d0;
}
.export-btn:hover:not(:disabled) {
  background: #d1fae5;
  border-color: #6ee7b7;
}

/* 历史下拉框 */
.history-select {
  height: 34px;
  padding: 0 28px 0 12px;
  font-size: 13px;
  color: #1e293b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 30px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  min-width: 130px;
}

.history-select:hover {
  border-color: #cbd5e1;
}

/* 颜色选择器 */
.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.color-picker-wrapper input[type="color"] {
  width: 30px;
  height: 30px;
  padding: 2px;
  border: 1px solid #e2e8f0;
  border-radius: 30px;
  cursor: pointer;
  background: white;
}
.color-picker-wrapper input[type="color"]:hover {
  border-color: #3b82f6;
}

/* 未选中提示 */
.hint {
  height: 34px;                   /* 固定高度，更整齐 */
  min-width: 64px;  
  color: #94a3b8;
  font-size: 13px;
  padding: 0 8px;
  white-space: nowrap;     
  line-height: 34px;
}
/* 属性组固定宽度，防止跳动 */
.property-group {
  min-width: 200px;
  justify-content: center;
}

/* 占位提示样式 */
.placeholder-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  color: #94a3b8;
  font-size: 13px;
  background: #f8fafc;
  border-radius: 30px;
  height: 34px;
}

.hint-icon {
  font-size: 16px;
}

.hint-text {
  font-weight: 400;
  letter-spacing: 0.3px;
}

/* 属性标签 */
.property-label {
  font-size: 13px;
  color: #64748b;
  margin-right: 4px;
}

/* 颜色选择器包装 */
.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  height: 34px;
  background: #f8fafc;
  border-radius: 30px;
}
.zoom-indicator {
  font-size: 13px;
  color: #64748b;
  padding: 0 4px;
  min-width: 45px;
  text-align: center;
}
.hint {
  color: #94a3b8;
  font-size: 12px;
  padding: 0 8px;
}
.filter-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.slider-wrapper input[type="range"] {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  background: #e2e8f0;
  border-radius: 2px;
}

.slider-wrapper input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.tool-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
</style>