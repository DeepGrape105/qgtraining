<template>
  <div class="right-sidebar">
    <div class="panel-header">属性面板</div>
    
    <div v-if="selectedEl" class="panel-body">
      
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

      <div class="prop-group" v-if="selectedEl.type === 'text'">
        <div class="group-title">文字属性</div>
        
        <div class="prop-row" style="flex-wrap: wrap;">
          <button @mousedown.prevent @click="applyTextStyle('bold')" :class="{ 'active': editor?.isActive('bold') }">B</button>
          <button @mousedown.prevent @click="applyTextStyle('italic')" :class="{ 'active': editor?.isActive('italic') }">I</button>
          <button @mousedown.prevent @click="applyTextStyle('underline')" :class="{ 'active': editor?.isActive('underline') }">U</button>
          <button @mousedown.prevent @click="applyTextStyle('strike')" :class="{ 'active': editor?.isActive('strike') }">S</button>
        </div>
        
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
        
        <div class="prop-row">
          <div class="input-item">
            <label>字号</label>
            <input type="number" v-model.number="selectedEl.fontSize" @change="onValueChange" min="12" max="72" />
          </div>
        </div>
        
        <div class="prop-row">
          <div class="input-item">
            <label>文字颜色</label>
            <input type="color" :value="editor?.getAttributes('textStyle').color || '#000000'" @input="e => setTextColor(e.target.value)" />
          </div>
        </div>

        <div class="prop-row">
          <div class="input-item">
            <label>高亮</label>
            <input type="color" :value="editor?.getAttributes('highlight').color || '#ffffff'" @input="e => setTextBackground(e.target.value)" />
          </div>
        </div>
      </div>

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

      <div class="prop-group">
        <div class="group-title">外观样式</div> 

        <div class="prop-row" v-if="selectedEl.type !== 'text' && selectedEl.type !== 'image'">
          <div class="input-item">
            <label>填充颜色</label>
            <input type="color" v-model="selectedEl.fill" @input="onValueChange" />
          </div>
        </div>

        <div class="prop-row" v-if="selectedEl.type === 'text'">
          <div class="input-item">
             <label>背景颜色</label>
            <input type="color" v-model="selectedEl.backgroundColor" @input="onValueChange" />
          </div>
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
/**
 * 属性面板逻辑层
 */
import { computed , ref} from 'vue'
import { useCanvasStore } from '../store/canvasStore'
import { useElements } from '../composables/useElements'
import { useHistory } from '../composables/useHistory'
import { useText } from '../composables/useText'

// 依赖注入与 Hook 初始化
const store = useCanvasStore()
const { removeSelected, updateElement } = useElements() // 图形操作方法
const { record } = useHistory()                         // 撤销重做快照
const { editor, editingId, activeStyles } = useText()    // 富文本编辑器状态
const styleUpdateKey = ref(0)

/**
 * 当前选中的单个元素（如果是多选则返回 null）
 * @returns {Object|null}
 */
const selectedEl = computed(() => {
  const ids = store.selectedIds
  if (ids.length !== 1) return null
  return store.elements.find(el => el.id === ids[0])
})

/**
 * 当任何属性发生改变时，记录历史状态快照，以便撤销
 */
const onValueChange = () => {
  record()
}

/**
 * 图层置顶：计算当前所有元素的最高 ZIndex 并加一
 */
const bringToFront = () => {
  if (!selectedEl.value) return
  record()
  const maxZ = Math.max(...store.elements.map(e => e.zIndex || 0), 0)
  selectedEl.value.zIndex = maxZ + 1
}

/**
 * 图层置底：计算当前所有元素的最低 ZIndex 并减一
 */
const sendToBack = () => {
  if (!selectedEl.value) return
  record()
  const minZ = Math.min(...store.elements.map(e => e.zIndex || 0), 0)
  selectedEl.value.zIndex = minZ - 1
}

/**
 * 三角形质心计算（仅针对 triangle 类型）
 * 质心坐标 = (x1+x2+x3)/3, (y1+y2+y3)/3
 */
const triangleCenter = computed(() => {
  if (!selectedEl.value || selectedEl.value.type !== 'triangle') return { x: 0, y: 0 }
  const points = selectedEl.value.points
  return {
    x: Math.round((points[0].x + points[1].x + points[2].x) / 3),
    y: Math.round((points[0].y + points[1].y + points[2].y) / 3)
  }
})

/**
 * 更新三角形位置：保持形状不变的情况下整体偏移三个顶点
 * @param {'x'|'y'} axis 轴向
 * @param {string|number} value 目标位置值
 */
const updateTrianglePosition = (axis, value) => {
  if (!selectedEl.value || selectedEl.value.type !== 'triangle') return
  record()
  const delta = Number(value) - triangleCenter.value[axis]
  const points = selectedEl.value.points
  const newPoints = points.map(p => ({
    x: axis === 'x' ? p.x + delta : p.x,
    y: axis === 'y' ? p.y + delta : p.y
  }))
  updateElement(selectedEl.value.id, { points: newPoints })
}

/**
 * 应用 Tiptap 富文本样式并同步回 Store
 * @param {string} type 样式类型（bold/italic/etc.）
 */
const applyTextStyle = (type) => {
  if (!editor.value || !editingId.value) return
  
  const chain = editor.value.chain().focus()
  if (type === 'bold') chain.toggleBold().run()
  else if (type === 'italic') chain.toggleItalic().run()
  else if (type === 'underline') chain.toggleUnderline().run()
  else if (type === 'strike') chain.toggleStrike().run()
  
  if (selectedEl.value) {
    // 强制同步 HTML 内容，确保非编辑模式下的 Canvas 渲染更新
    selectedEl.value.richText = editor.value.getHTML()
    // 通过重新赋值触发 Vue 的响应式依赖通知（针对数组内部对象的属性修改）
    store.elements = [...store.elements]
    onValueChange()
  }
}

/**
 * 设置选中文字的颜色（使用 Tiptap Color 扩展）
 */
const setTextColor = (color) => {
  if (!editor.value || !editingId.value) return
  editor.value.chain().focus().setColor(color).run()
}

/**
 * 设置选中文字的背景高亮色
 * 自动处理十六进制颜色为半透明 rgba 格式以获得更好的视觉叠加效果
 */
const setTextBackground = (color) => {
  if (!editor.value || !editingId.value) return
  const rgba = color.startsWith('#') 
    ? `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.5)`
    : color
  editor.value.chain().focus().setHighlight({ color: rgba }).run()
}
</script>

<style scoped src="../styles/rightSidebar.css"></style>