import { defineStore } from 'pinia'

/**
 * useCanvasStore
 * 职责域：
 * 1. 领域模型存储：管理画布图元（Elements）的完整生命周期数据。
 * 2. 交互状态同步：维护选中态（Selection）、剪贴板（Clipboard）及框选上下文。
 * 3. 渲染参数控制：驱动视口变换矩阵（Viewport）及全局网格系统配置。
 * 4. 历史记录管理：维护撤销（History）与重做（Future）的指令栈。
 */
export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    // 元素图层树：存储所有图形实体的结构化数据
    elements: [],

    // 对齐辅助线数据
    snapLines: [],
    // 选中集：存储当前处于活跃状态的图元 ID 序列
    selectedIds: [],

    // 组合元数据映射：{ groupId: { name: string, expanded: boolean } }
    // 用于处理图元的拓扑聚合与大纲层级的逻辑关联
    groups: {},

    // 全局物理环境配置
    canvasConfig: {
      showGrid: true,         // 背景网格可见性
      gridSize: 30,           // 空间步进精度（像素）
      backgroundColor: '#ffffff'
    },

    // 视口投影变换矩阵数据
    viewport: {
      offsetX: 0,    // 坐标系水平位移
      offsetY: 0,    // 坐标系垂直位移
      scale: 1       // 仿射变换缩放比例系数
    },

    // 历史版本快照栈，用于实现命令模式下的撤销重做逻辑
    history: [],
    future: [],

    // 临时数据缓冲区，用于跨图层或跨画布的图元复制粘贴
    clipboard: null,

    // 瞬态交互状态：矩形框选的实时几何描述
    marqueeRect: null
  }),

  getters: {
    /**
     * 当前首选元素 (Primary Selection)
     * 返回选中集合中的第一个对象，常用于属性面板的单一绑定
     */
    selection: (state) => state.selectedIds[0] || null,

    /**
     * 场景全局边界 (Scene Bounds)
     * 计算所有活跃图元在世界坐标系下的最大外包围盒（AABB）。
     * 业务逻辑：
     * 1. 动态拓扑：若画布为空，则回退至当前视窗尺寸。
     * 2. 无限空间模拟：通过 Padding 机制在极值点外扩缓冲区，模拟无限画布的视觉延展感。
     * 3. 渲染驱动：该值常用于小地图（Minimap）的比例计算或滚动条的边界界定。
     */
    sceneBounds: (state) => {
      if (state.elements.length === 0) {
        return {
          minX: 0,
          minY: 0,
          maxX: window.innerWidth,
          maxY: window.innerHeight,
          width: window.innerWidth,
          height: window.innerHeight
        };
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      state.elements.forEach(el => {
        // 调用外部数学库计算单个图元的绝对几何边界
        const bounds = getElementAbsoluteBounds(el);
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      });

      // 边缘缓冲逻辑：1000px 的冗余空间允许用户在内容边界外继续自由操作
      const padding = 1000;
      return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2
      };
    }
  }
})