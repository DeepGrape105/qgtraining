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

    <div class="tool-group">
      <template v-if="selectedCount === 1 && selectedEl">
        <button class="tool-btn delete-btn" @click="removeSelected">删除</button>
      </template>
      
      <template v-else-if="selectedCount > 1">
        <button class="tool-btn" @click="group">📁 打组</button>
        <button class="tool-btn" @click="ungroup">📂 解组</button>
        <button class="tool-btn delete-btn" @click="removeSelected">删除</button>
      </template>
      
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
         导出为 PNG
      </button>
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <button class="tool-btn" @click="toggleGrid">{{ store.canvasConfig.showGrid ? '▦' : '□' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from '../composables/useElements'
import { saveCanvasApi, getHistoryListApi, getSnapshotDataApi } from '../api/canvas'
import { uploadImageApi } from '../api/upload'
import { useViewport } from '../composables/useViewport'
import{ useHistory } from '../composables/useHistory'
import { useText } from '../composables/useText'

/**
 * 核心逻辑注入
 */
const store = useCanvasStore()
const {zoomIn, zoomOut } = useViewport() // 视口缩放管理
const { record } = useHistory()           // 撤销/重做历史快照记录
const {addText} = useText()               // 文本实例化逻辑
const { 
  addRect, addCircle, addTriangle, addImage, 
  removeSelected, updateSelected,
  setElements, getElements, getConfig, clearSelection,
  group, ungroup 
} = useElements()

// 异步状态标识
const isSaving = ref(false);
const isUploading = ref(false);
const fileInputRef = ref(null);

// 后端版本数据记录
const historyList = ref([]);
const selectedHistory = ref('');

/**
 * 计算属性：获取当前选中的单个元素对象
 * 限制：仅在单选模式下返回，多选时返回 null 以防属性冲突
 */
const selectedEl = computed(() => {
  const ids = store.selectedIds
  if (ids.length !== 1) return null  
  return store.elements.find(el => el.id === ids[0])
})

// 计算当前选中的元素总数，驱动 UI 按钮显示
const selectedCount = computed(() => store.selectedIds.length)

/**
 * 实时更新元素填充颜色
 * 在修改前调用 record() 确保该操作可以被撤销
 */
const updateElementFill = (color) => {
  record() 
  updateSelected({ fill: color })
}

/**
 * 图片插入流程 I：触发原生文件选择器
 */
const triggerUpload = () => {
  if (fileInputRef.value) fileInputRef.value.click();
};

/**
 * 图片插入流程 II：异步上传与 Canvas 实例化
 * 流程：Upload API -> 获取 URL -> 预加载 Image 对象获取宽高 -> 插入画布
 */
const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  isUploading.value = true;
  try {
    const url = await uploadImageApi(file);
    const img = new Image();
    img.src = url;
    // 必须等待 onload 确保能获取到图片的原始宽高，避免插入时比例失真
    img.onload = () => {
      addImage(url, img.width, img.height)
    };
  } catch (error) {
    console.error('[Toolbar] Image upload failed:', error)
  } finally {
    isUploading.value = false
    e.target.value = '' // 清空 input，允许连续上传同一张图片
  }
};

/**
 * 获取云端历史记录列表
 */
const fetchHistory = async () => {
  try {
    const res = await getHistoryListApi('1'); // '1' 为硬编码的项目 ID
    historyList.value = res || [];
  } catch (error) {
    console.error('[Toolbar] Fetch history failed:', error);
  }
};

/**
 * 数据持久化：将当前画布状态同步至服务器
 * 关键点：使用 JSON 深拷贝断开响应式连接，确保存储的是静态快照
 */
const saveToServer = async () => {
  const elements = getElements()
  if (elements.length === 0) return alert('画布为空，无需保存')
  
  isSaving.value = true
  try {
    // 过滤响应式代理带来的副作用
    const pureElements = JSON.parse(JSON.stringify(elements))
    const pureConfig = JSON.parse(JSON.stringify(getConfig()))
    
    await saveCanvasApi('1', pureElements, pureConfig)
    // 保存成功后清除本地暂存草稿
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
 * 版本回滚逻辑
 * 获取选定版本的 JSON 数据并覆盖当前画布状态
 */
const loadHistory = async () => {
  if (!selectedHistory.value) return;
  
  // 危险操作：二次确认以防误触
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
    selectedHistory.value = ''; // 重置下拉框状态
  }
};

/**
 * 导出逻辑：将 HTMLCanvasElement 转换为图像文件
 * 步骤：清除选中高亮 -> 等待 DOM 刷新 -> 获取 Base64 流 -> 模拟点击下载
 */
const exportToImage = async () => {
  // 必须清除选中状态，否则导出的图片会包含操作框和缩放手柄
  clearSelection()

  // 等待 Vue 响应式导致的画布重绘完成
  await nextTick(); 
  
  const canvasEl = document.querySelector('canvas');
  if (!canvasEl) return;
  
  try {
    // 注意：如果 Canvas 中包含跨域图片且未配置 CORS，此处会抛出 SecurityError
    const dataUrl = canvasEl.toDataURL('image/png', 1.0); 
    const link = document.createElement('a');
    link.download = `export_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('[Toolbar] Export failed. Check CORS policy:', error);
    alert('导出失败，请检查控制台跨域拦截信息。')
  }
}

/**
 * 初始加载：挂载后自动同步历史记录
 */
onMounted(() => {
  fetchHistory()
})

/**
 * 切换网格辅助线显示状态
 */
const toggleGrid = () => {
  store.canvasConfig.showGrid = !store.canvasConfig.showGrid
}

</script>

<style scoped src="../styles/toolbar.css"></style>