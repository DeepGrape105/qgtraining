<template>
  <div class="right-sidebar">
    <div class="panel-header">属性面板</div>
    
    <div v-if="selectedEl" class="panel-body">
      
      <!-- ========== 三角形专属 ========== -->
      <template v-if="selectedEl.type === 'triangle'">
        <div class="prop-group">
          <div class="group-title">位置</div>
          <div class="prop-row">
            <div class="input-item">
              <label>X</label>
              <input type="number" :value="triangleCenter.x" @input="e => updateTrianglePosition('x', e.target.value)" />
            </div>
            <div class="input-item">
              <label>Y</label>
              <input type="number" :value="triangleCenter.y" @input="e => updateTrianglePosition('y', e.target.value)" />
            </div>
          </div>
          <div class="prop-row">
        <div class="input-item">
          <label>旋转</label>
          <input 
            type="number" 
            v-model.number="selectedEl.rotation" 
            @input="onValueChange"
            min="-360"
            max="360"
            step="1"
          />
        </div>
      </div>
        </div>
      </template>

      <!-- ========== 非三角形：位置与大小 ========== -->
      <div class="prop-group" v-if="selectedEl.type !== 'triangle'">
        <div class="group-title">位置与大小</div>
        <div class="prop-row">
          <div class="input-item">
            <label>X</label>
            <input type="number" v-model.number="selectedEl.x" @change="onValueChange" />
          </div>
          <div class="input-item">
            <label>Y</label>
            <input type="number" v-model.number="selectedEl.y" @change="onValueChange" />
          </div>
        </div>
        <div class="prop-row" v-if="selectedEl.type !== 'circle' && selectedEl.type !== 'text' && selectedEl.type !== 'image'">
          <div class="input-item">
            <label>宽</label>
            <input type="number" v-model.number="selectedEl.width" @change="onValueChange" />
          </div>
          <div class="input-item">
            <label>高</label>
            <input type="number" v-model.number="selectedEl.height" @change="onValueChange" />
          </div>
        </div>
        <div class="prop-row">
        <div class="input-item">
          <label>旋转</label>
          <input 
            type="number" 
            v-model.number="selectedEl.rotation" 
            @input="onValueChange"
            min="-360"
            max="360"
            step="1"
          />
        </div>
      </div>
        <div class="prop-row" v-if="selectedEl.type === 'image'">
          <div class="input-item">
            <label>宽</label>
            <input type="number" v-model.number="selectedEl.width" @change="onValueChange" />
          </div>
          <div class="input-item">
            <label>高</label>
            <input type="number" v-model.number="selectedEl.height" @change="onValueChange" />
          </div>
        </div>
        <div class="prop-row" v-if="selectedEl.type === 'circle'">
          <div class="input-item">
            <label>半径</label>
            <input type="number" v-model.number="selectedEl.radius" @change="onValueChange" />
          </div>
        </div>
      </div>

      <!-- 文字属性 -->
      <div class="prop-group" v-if="selectedEl.type === 'text'">
        <div class="group-title">文字属性</div>
        
        <!-- 富文本样式 -->
        <div class="prop-row" style="flex-wrap: wrap;">
          <button @mousedown.prevent @click="applyTextStyle('bold')" :class="{ 'active': editor?.isActive('bold') }">B</button>
          <button @mousedown.prevent @click="applyTextStyle('italic')" :class="{ 'active': editor?.isActive('italic') }">I</button>
          <button @mousedown.prevent @click="applyTextStyle('underline')" :class="{ 'active': editor?.isActive('underline') }">U</button>
          <button @mousedown.prevent @click="applyTextStyle('strike')" :class="{ 'active': editor?.isActive('strike') }">S</button>
        </div>
        
        <!-- 字体 -->
        <div class="prop-row">
          <div class="input-item">
            <label>字体</label>
            <select v-model="selectedEl.fontFamily" @change="onValueChange">
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="'Microsoft YaHei'">微软雅黑</option>
              <option value="'SimSun'">宋体</option>
            </select>
          </div>
        </div>
        
        <!-- 字号 -->
        <div class="prop-row">
          <div class="input-item">
            <label>字号</label>
            <input type="number" v-model.number="selectedEl.fontSize" @change="onValueChange" min="12" max="72" />
          </div>
        </div>
        
        <!-- 文字颜色 -->
        <div class="prop-row">
          <div class="input-item">
            <label>文字颜色</label>
            <input type="color" :value="editor?.getAttributes('textStyle').color || '#000000'" @input="e => setTextColor(e.target.value)" />
          </div>
        </div>

        <!-- 背景色 -->
        <div class="prop-row">
          <div class="input-item">
            <label>高亮</label>
            <input type="color" :value="editor?.getAttributes('highlight').color || '#ffffff'" @input="e => setTextBackground(e.target.value)" />
          </div>
        </div>

      </div>

      <!-- 图片滤镜 -->
      <div class="prop-group" v-if="selectedEl.type === 'image'">
        <div class="group-title">图片滤镜</div>
        <div class="prop-row">
          <label>灰度</label>
          <input type="checkbox" v-model="selectedEl.filters.grayscale" @change="onValueChange" />
        </div>
        <div class="prop-row full">
          <label>亮度</label>
          <input type="range" min="-100" max="100" step="1" v-model.number="selectedEl.filters.brightness" @change="onValueChange" />
          <span>{{ selectedEl.filters.brightness || 0 }}</span>
        </div>
        <div class="prop-row full">
          <label>对比度</label>
          <input type="range" min="-100" max="100" step="1" v-model.number="selectedEl.filters.contrast" @change="onValueChange" />
          <span>{{ selectedEl.filters.contrast || 0 }}</span>
        </div>
      </div>

      <!-- 外观样式 -->
       
      <div class="prop-group">
        <div class="group-title">外观样式</div> 

         <div class="prop-row" v-if="selectedEl.type !== 'text' && selectedEl.type !== 'image'">
          <div class="input-item">
            <label>填充颜色</label>
            <input type="color" v-model="selectedEl.fill" @input="onValueChange" />
          </div>
        </div>

        <div  class="prop-row"></div v-if="selectedEl.type === 'text'">
        <div class="input-item">
          <label>背景颜色</label>
          <input type="color" v-model="selectedEl.backgroundColor" @input="onValueChange" />
        </div>

        <div class="prop-row">
          <div class="input-item">
            <label>边框颜色</label>
            <input type="color" v-model="selectedEl.stroke" @input="onValueChange" />
          </div>
        </div>
        
        <div class="prop-row">
          <div class="input-item">
            <label>边框宽度</label>
            <input type="number" v-model.number="selectedEl.strokeWidth" @input="onValueChange" min="0" max="20" step="0.5" />
          </div>
        </div>
        
        <div class="prop-row">
          <div class="input-item">
            <label>不透明度</label>
            <input type="range" min="0" max="1" step="0.1" v-model.number="selectedEl.opacity" @change="onValueChange" />
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="prop-group">
        <div class="group-title">快捷操作</div>
        <div class="button-grid">
          <button @click="bringToFront">置顶层</button>
          <button @click="sendToBack">置底层</button>
          <button @click="removeSelected" class="danger">删除元素</button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      请在画布上选择一个元素
    </div>
  </div>
</template>

<script setup>
import { computed , ref} from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from '../composables/useElements'
import { useHistory } from '../composables/useHistory'
import { useText } from '../composables/useText'

const store = useCanvasStore()
const { removeSelected, updateElement } = useElements()
const { record } = useHistory()
const { editor, editingId, activeStyles } = useText()
const styleUpdateKey = ref(0)

const selectedEl = computed(() => {
  const ids = store.selectedIds
  if (ids.length !== 1) return null
  return store.elements.find(el => el.id === ids[0])
})

const onValueChange = () => {
  record()
}

const bringToFront = () => {
  if (!selectedEl.value) return
  record()
  const maxZ = Math.max(...store.elements.map(e => e.zIndex || 0), 0)
  selectedEl.value.zIndex = maxZ + 1
}

const sendToBack = () => {
  if (!selectedEl.value) return
  record()
  const minZ = Math.min(...store.elements.map(e => e.zIndex || 0), 0)
  selectedEl.value.zIndex = minZ - 1
}

const triangleCenter = computed(() => {
  if (!selectedEl.value || selectedEl.value.type !== 'triangle') return { x: 0, y: 0 }
  const points = selectedEl.value.points
  return {
    x: Math.round((points[0].x + points[1].x + points[2].x) / 3),
    y: Math.round((points[0].y + points[1].y + points[2].y) / 3)
  }
})

const updateTrianglePosition = (axis, value) => {
  if (!selectedEl.value || selectedEl.value.type !== 'triangle') return
  record()
  const delta = Number(value) - triangleCenter.value[axis]
  const points = selectedEl.value.points
  const newPoints = points.map(p => ({
    x: p.x + delta,
    y: p.y + delta
  }))
  updateElement(selectedEl.value.id, { points: newPoints })
}

// 修改 RightSidebar.vue 中的 applyTextStyle 函数
const applyTextStyle = (type) => {
  if (!editor.value || !editingId.value) return
  
  const chain = editor.value.chain().focus()
  if (type === 'bold') chain.toggleBold().run()
  else if (type === 'italic') chain.toggleItalic().run()
  else if (type === 'underline') chain.toggleUnderline().run()
  else if (type === 'strike') chain.toggleStrike().run()
  
  if (selectedEl.value) {
    // 保存富文本内容到元素
    selectedEl.value.richText = editor.value.getHTML()
    // 触发画布重绘
    store.elements = [...store.elements]
    onValueChange()
  }
}
// 设置选中文字颜色
const setTextColor = (color) => {
  if (!editor.value || !editingId.value) return
  editor.value.chain().focus().setColor(color).run()
}

// 设置选中文字背景色
const setTextBackground = (color) => {
  if (!editor.value || !editingId.value) return
  // 把纯色转成半透明
  const rgba = color.startsWith('#') 
    ? `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.5)`
    : color
  editor.value.chain().focus().setHighlight({ color: rgba }).run()
}

const isStyleActive = (type) => {
  if (!editor.value) return false  // ← 加这行
  return editor.value.isActive(type)
}
</script>

<style scoped>
.right-sidebar {
  width: 260px;
  background: white;
  border-left: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  z-index: 10;
}
.panel-header { padding: 12px; font-weight: bold; border-bottom: 1px solid #eee; background: #fafafa; }
.panel-body { flex: 1; overflow-y: auto; padding: 15px; }
.prop-group { margin-bottom: 20px; }
.group-title { font-size: 12px; color: #888; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; }
.prop-row { display: flex; gap: 10px; margin-bottom: 10px; }
.prop-row.full { flex-direction: column; }
.input-item { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.input-item label { font-size: 12px; color: #666; }
input[type="number"], input[type="text"], textarea {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
input[type="color"] {
  width: 100%;
  height: 32px;
  padding: 2px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}
input[type="range"] {
  flex: 1;
}
textarea { height: 60px; resize: vertical; }
.button-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
button { padding: 6px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: white; font-size: 12px; }
button:hover { background: #f0f0f0; }
button.danger { grid-column: span 2; color: #ff4d4f; border-color: #ff4d4f; }
button.danger:hover { background: #fff1f0; }
.empty-state { padding: 40px 20px; text-align: center; color: #999; font-size: 14px; }
.prop-row button {
  width: 32px;
  height: 32px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  font-weight: bold;
  cursor: pointer;
}
.prop-row button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
</style>