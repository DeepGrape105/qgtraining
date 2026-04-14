/**
   * 内部工具函数（generateId, getBaseElement）
   * 元素操作（addRect, addCircle, addTriangle, addImage, removeSelected, updateElement, updateSelected）
   * 批量操作（setElements）
   * 画布配置操作（updateCanvasConfig）
    * 选中操作（clearSelection, setSelection, getSelectedElement）
    * 持久化恢复（restoreState）
   */
  
import { useCanvasStore } from '../store/canvasStore'
import { useHistory } from './useHistory'

/**
 * 元素业务逻辑层
 * 负责所有元素的增删改查、默认值处理，以及持久化恢复
 */
export function useElements() {
  const store = useCanvasStore()
  const { record } = useHistory()

  /**
   * 生成唯一 ID
   * 处理逻辑：使用类型前缀 + 时间戳 + 随机字符串，确保在高频操作下也不会重复
   */
  const generateId = (type) => `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  /**
   * 获取基础元素属性（所有图形共用的）
   */
  const getBaseElement = (type, id) => ({
  id, type,
  x: 100, y: 100,
  fill: '#Fff',           // 文字默认黑色
  backgroundColor: 'transparent',
  stroke: '#000000',
  strokeWidth: 1,
  opacity: 1,
  zIndex: store.elements.length + 1,
  rotation: 0
})

  /**
   * 添加矩形
   */
  const addRect = () => {
    record()
    const id = generateId('rect')
    const element = {
      ...getBaseElement('rect', id),
      width: 100,
      height: 100
    }
    store.elements.push(element)
    store.selection = id
  }

  /**
   * 添加圆形
   */
  const addCircle = () => {
    record()
    const id = generateId('circle')
    const element = {
      ...getBaseElement('circle', id),
      radius: 50
    }
    store.elements.push(element)
    store.selection = id
  }

  /**
   * 添加三角形
   */
 const addTriangle = () => {
  record()
  const id = generateId('triangle')
  store.elements.push({
    ...getBaseElement('triangle', id),
    points: [
      { x: 150, y: 50 },
      { x: 100, y: 150 },
      { x: 200, y: 150 }
    ]
  })
  store.selectedIds = [id]
}

  /**
   * 添加图片
   * 处理逻辑：
   * 1.接受图片 URL 和可选的宽高参数，并限制最大宽度为 300
   * 2.如果未提供宽高，则默认设置为 200x200，同时保持图片的原始宽高比进行缩放，防止图片过大
   */
  const addImage = (url, width, height) => {
    record()
    const id = generateId('image')

    const maxWidth = 300
    const maxHeight = 300

    let finalWidth = width
    let finalHeight = height

    // 计算缩放比例，保持宽高比
    if (width > maxWidth || height > maxHeight) {
      const widthRatio = maxWidth / width
      const heightRatio = maxHeight / height
      const ratio = Math.min(widthRatio, heightRatio)

      finalWidth = width * ratio
      finalHeight = height * ratio
    }

    const element = {
      ...getBaseElement('image', id),
      url,
      width: finalWidth,
      height: finalHeight,
      filters: {
        grayscale: false,
        brightness: 0,
        contrast: 0
      }
    }
    store.elements.push(element)
    store.selection = id
  }

  /**
   * 删除选中的元素
   * 处理逻辑：如果没有选中任何元素，不执行删除，防止误操作导致全部元素被删除
   * 如果有选中元素，则过滤掉该元素，并清空选中状态
   */
  const removeSelected = () => {
    if (store.selectedIds.length === 0) return
    record()
    store.elements = store.elements.filter(el => !store.selectedIds.includes(el.id))
    store.selectedIds = []

  }

  /**
   * 更新指定元素的属性
   * 处理逻辑：通过元素 ID 查找对应元素，并使用新的属性覆盖旧属性，保持其他属性不变
   */
  const updateElement = (id, props) => {
    if (!id || !props) return
    const index = store.elements.findIndex(el => el.id === id)

    //如果找到元素，则更新属性
    if (index !== -1) {
      store.elements[index] = { ...store.elements[index], ...props }
    } else {
      console.warn(`[useElements] 元素 ${id} 不存在`)
    }
  }

  /**
   * 更新选中的元素的属性的快捷方法，方便Toolbar组件调用
   */
  const updateSelected = (props) => {
    store.selectedIds.forEach(id => updateElement(id, props))
  }

  // 剪贴板逻辑
  const copyElement = () => {
    const target = store.elements.find(el => el.id === store.selection)
    if (target) store.clipboard = JSON.stringify(target)
  }

  const pasteElement = () => {
    record()
    if (!store.clipboard) return
    record()
    const newEl = JSON.parse(store.clipboard)
    newEl.id = generateId(newEl.type)
    newEl.x += 20; newEl.y += 20
    store.elements.push(newEl)
    store.selection = newEl.id
  }

  /**
   * 批量替换所有元素（用于历史回滚、加载数据）
   */
  const setElements = (elements) => {
    store.elements = elements
  }

  /**
   * 清空选中
   */
  const clearSelection = () => {
    store.selectedIds = []
  }


  /**
   * 设置选中
   */
  const setSelection = (id) => {
    store.selectedIds = [id]
  }

  /**
   * 获取当前选中的元素
   */
  const getSelectedElement = () => {
    const id = store.selectedIds[0]
    return id ? store.elements.find(el => el.id === id) : null
  }

    /**
   * 获取画布配置
   */
  const getConfig = () => {
    return store.canvasConfig
  }

  /**
   * 设置画布配置（部分更新）
   */
  const setConfig = (config) => {
    store.canvasConfig = { ...store.canvasConfig, ...config }
  }

  /**
   * 获取所有元素
   */
  const getElements = () => {
    return store.elements
  }

  /**
   * 获取选中元素的 ID
   */
  const getSelection = () => {
    return store.selection
  }

  /**
   * 批量替换元素和配置（用于持久化恢复）
   */
  const restoreState = (elements, config) => {
    if (elements !== undefined) {
      store.elements = elements
    }
    if (config !== undefined) {
      store.canvasConfig = config
    }
  }

  const bringToFront = () => {
    const el = store.elements.find(e => e.id === store.selection);
    if (!el) return;
    record();
    const maxZ = Math.max(...store.elements.map(e => e.zIndex || 0), 0);
    el.zIndex = maxZ + 1;
  };

  // 2. 修改层级：置底
  const sendToBack = () => {
    const el = store.elements.find(e => e.id === store.selection);
    if (!el) return;
    record();
    const minZ = Math.min(...store.elements.map(e => e.zIndex || 0), 0);
    el.zIndex = minZ - 1;
  };

  // 3. 状态切换：锁定/隐藏 (需要在 getBaseElement 里增加默认字段)
  const toggleLock = (id) => {
    const el = store.elements.find(e => e.id === id);
    if (el) el.isLocked = !el.isLocked;
  };

  const toggleVisible = (id) => {
    const el = store.elements.find(e => e.id === id);
    if (el) el.isVisible = (el.isVisible === undefined) ? false : !el.isVisible;
  };

  const toggleSelection = (id) => {
    if (store.selectedIds.includes(id)) {
      store.selectedIds = store.selectedIds.filter(i => i !== id)
    } else {
      store.selectedIds.push(id)
    }
  }

  return {
    // 内部工具函数
    generateId,
    getBaseElement,
    // 添加
    addRect,
    addCircle,
    addTriangle,
    addImage,
    // 删除
    removeSelected,
    // 更新
    updateElement,
    updateSelected,
    // 剪贴板
    copyElement,
    pasteElement,
    // 批量操作
    setElements,
    // 选中操作
    clearSelection,
    setSelection,
    getSelectedElement,
    // 配置操作
    getConfig,
    setConfig,
    getElements,
    getSelection,
    restoreState,
    // 层级操作
    bringToFront,
    sendToBack,
    // 状态切换
    toggleLock,
    toggleVisible,
    //选中操作
    toggleSelection
  }
}