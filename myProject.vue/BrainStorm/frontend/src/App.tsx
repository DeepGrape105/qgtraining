import { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  type ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

import { CustomNode } from './components/CustomNode';
import { CustomEdge } from './components/CustomEdge';
import { BoxModal } from './components/BoxModal';
import { HistoryManager } from './utils/HistoryManager';
import { api } from './services/api';
import type { GraphItem } from './types';

let nextNodeId = 10;
let nextEdgeId = 100;

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

declare global {
  interface Window {
    __rfConnecting: boolean;
  }
}

// 自动布局函数 - 使用 dagre 算法
// 无向布局 - 不区分方向，只根据连接关系布局
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 重要：设置无向边，忽略方向
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target, { directed: false });
  });

  const nodeCount = nodes.length;
  const spacing = nodeCount > 20 ? 70 : nodeCount > 10 ? 90 : 110;

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: spacing,
    ranksep: spacing * 1.2,
    marginx: 60,
    marginy: 60,
    align: 'DL',
    ranker: 'network-simplex'
  });

  nodes.forEach((node) => {
    const labelLength = node.data.label.length;
    const width = Math.min(220, Math.max(110, labelLength * 11 + 30));
    dagreGraph.setNode(node.id, { width, height: 60 });
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const labelLength = node.data.label.length;
    const width = Math.min(220, Math.max(110, labelLength * 11 + 30));
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - 30,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// 修正边的锚点，让连线从正确的方向连接
const fixEdgeAnchors = (edges: Edge[], layoutDirection: 'TB' | 'LR') => {
  return edges.map(edge => {
    if (layoutDirection === 'LR') {
      return {
        ...edge,
        sourceHandle: edge.sourceHandle || 'right',
        targetHandle: edge.targetHandle || 'left',
      };
    } else {
      return {
        ...edge,
        sourceHandle: edge.sourceHandle || 'bottom',
        targetHandle: edge.targetHandle || 'top',
      };
    }
  });
};

function FlowContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('LR');

  const [showBrainstormBox, setShowBrainstormBox] = useState(false);
  const [showDraftBox, setShowDraftBox] = useState(false);
  const [showRecycleBox, setShowRecycleBox] = useState(false);

  const [brainstormList, setBrainstormList] = useState<GraphItem[]>([]);
  const [draftList, setDraftList] = useState<GraphItem[]>([]);
  const [recycleList, setRecycleList] = useState<GraphItem[]>([]);

  const [brainstormTopic, setBrainstormTopic] = useState('');
  const [brainstormLoading, setBrainstormLoading] = useState(false);
  const [showBrainstormInput, setShowBrainstormInput] = useState(false);
  const { fitView } = useReactFlow();

  const historyManager = useRef(new HistoryManager());
  const isUndoRedo = useRef(false);
  const currentGraphName = useRef<string>('未命名');
  const currentGraphId = useRef<string | null>(null);
  const currentGraphBoxType = useRef<string | null>(null);

  const [showTextAnalyzer, setShowTextAnalyzer] = useState(false);
  const [analyzeText, setAnalyzeText] = useState('');
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [showSaveToBrainstormBtn, setShowSaveToBrainstormBtn] = useState(false);
  const [pendingNodes, setPendingNodes] = useState<Node[]>([]);
  const [pendingEdges, setPendingEdges] = useState<Edge[]>([]);

  // 记录最后保存的内容，用于判断是否需要询问保存
  const lastSavedContent = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  // 重连相关状态
  const [reconnectingEdge, setReconnectingEdge] = useState<{
    id: string;
    end: 'source' | 'target';
  } | null>(null);

  const pushToHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (!isUndoRedo.current) historyManager.current.push(newNodes, newEdges);
    isUndoRedo.current = false;
    localStorage.setItem('knowledge-graph-backup', JSON.stringify({ nodes: newNodes, edges: newEdges, timestamp: Date.now() }));
  }, []);

  // 监听边标签更新
  useEffect(() => {
    const handleUpdateEdgeLabel = (event: CustomEvent) => {
      const { edgeId, label } = event.detail;
      setEdges((eds) => eds.map((edge) => edge.id === edgeId ? { ...edge, data: { ...edge.data, label }, label } : edge));
    };
    window.addEventListener('update-edge-label', handleUpdateEdgeLabel as EventListener);
    return () => window.removeEventListener('update-edge-label', handleUpdateEdgeLabel as EventListener);
  }, []);

  // 监听清除边选中事件
  useEffect(() => {
    const handleClearEdgeSelection = () => {
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    };
    window.addEventListener('clear-edge-selection', handleClearEdgeSelection);
    return () => {
      window.removeEventListener('clear-edge-selection', handleClearEdgeSelection);
    };
  }, [setEdges]);

  // 检查名称是否已存在
  const checkDuplicateName = async (title: string, boxType: string): Promise<boolean> => {
    const list = await api.listGraphs(boxType);
    return list.some((item: any) => item.title === title);
  };

  // 添加标签选中状态
  const [selectedLabelEdgeId, setSelectedLabelEdgeId] = useState<string | null>(null);

  // 清除所有选中的边（当标签被选中时）
  useEffect(() => {
    if (selectedLabelEdgeId !== null) {
      // 清除所有边的选中状态
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: false,
        }))
      );
    }
  }, [selectedLabelEdgeId, setEdges]);

  // 处理标签选中
  // 在 FlowContent 组件中
  const handleLabelSelect = useCallback((edgeId: string | null) => {
    setSelectedLabelEdgeId(edgeId);
    // 清除所有边的选中状态
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: e.id === edgeId ? false : false, // 清除所有选中
      }))
    );
  }, [setEdges]);

  useEffect(() => {
    if (nodes.length || edges.length) pushToHistory(nodes, edges);
  }, [nodes, edges, pushToHistory]);

  useEffect(() => {
    const handleLabelSelected = () => {
      // 清除所有边的选中状态
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    };
    window.addEventListener('label-selected', handleLabelSelected);
    return () => window.removeEventListener('label-selected', handleLabelSelected);
  }, [setEdges]);


  // 覆盖保存（直接保存到当前所在的箱子，不弹窗）
  // 覆盖保存（直接覆盖当前打开的内容，不弹窗）
  const overwriteSave = async () => {
    // 如果没有当前ID，说明是新建的未保存内容
    if (!currentGraphId.current) {
      const title = prompt('请输入名称', currentGraphName.current);
      if (!title) return;

      setLoading(true);
      try {
        const exists = await checkDuplicateName(title, currentGraphBoxType.current || 'draft');
        if (exists) {
          alert(`名称「${title}」已存在，请使用其他名称`);
          setLoading(false);
          return;
        }
        const id = await api.saveGraph(title, nodes, edges, currentGraphBoxType.current || 'draft');
        currentGraphId.current = id;
        currentGraphName.current = title;
        alert(`已保存到${currentGraphBoxType.current === 'brainstorm' ? '脑暴箱' : '草稿箱'}：${title}`);
        await loadAllBoxes();
        lastSavedContent.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      } catch (err) {
        alert('保存失败');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 有当前ID，直接覆盖，不弹窗
    setLoading(true);
    try {
      await api.updateGraph(currentGraphId.current, currentGraphName.current, nodes, edges, currentGraphBoxType.current || 'draft');
      alert(`已覆盖保存「${currentGraphName.current}」`);
      await loadAllBoxes();
      lastSavedContent.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    } catch (err) {
      // 如果后端没有 update 接口，使用删除+新建方式
      console.error('更新失败，尝试删除后新建:', err);
      try {
        // 先删除原来的
        await api.permanentDelete(currentGraphId.current);
        // 再新建
        const newId = await api.saveGraph(currentGraphName.current, nodes, edges, currentGraphBoxType.current || 'draft');
        currentGraphId.current = newId;
        alert(`已覆盖保存「${currentGraphName.current}」`);
        await loadAllBoxes();
        lastSavedContent.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      } catch (err2) {
        alert('保存失败: ' + (err2 as any).message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          const state = historyManager.current.undo();
          if (state) { isUndoRedo.current = true; setNodes(state.nodes); setEdges(state.edges); }
        } else if ((e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          const state = historyManager.current.redo();
          if (state) { isUndoRedo.current = true; setNodes(state.nodes); setEdges(state.edges); }
        } else if (e.key === 's') {
          e.preventDefault();
          overwriteSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, overwriteSave]);

  // 恢复本地缓存
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [cachedData, setCachedData] = useState<{ nodes: Node[]; edges: Edge[]; timestamp: number } | null>(null);

  useEffect(() => {
    const backup = localStorage.getItem('knowledge-graph-backup');
    if (backup) {
      try {
        const { nodes: savedNodes, edges: savedEdges, timestamp } = JSON.parse(backup);
        if (savedNodes?.length) {
          setCachedData({ nodes: savedNodes, edges: savedEdges, timestamp });
          setShowRestoreDialog(true);
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  // 切换布局方向
  const toggleLayoutDirection = () => {
    const newDirection = layoutDirection === 'TB' ? 'LR' : 'TB';
    setLayoutDirection(newDirection);
    let { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, newDirection);
    layoutedEdges = fixEdgeAnchors(layoutedEdges, newDirection);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);
  };

  const restoreFromCache = () => {
    if (cachedData) {
      setNodes(cachedData.nodes);
      setEdges(cachedData.edges);
      historyManager.current.clear();
      pushToHistory(cachedData.nodes, cachedData.edges);
      setShowRestoreDialog(false);
      setCachedData(null);
    }
  };

  const ignoreCache = () => {
    setShowRestoreDialog(false);
    setCachedData(null);
  };

  const onConnectStart = useCallback(() => { window.__rfConnecting = true; }, []);
  const onConnectEnd = useCallback(() => { window.__rfConnecting = false; }, []);
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    setEdges((eds) => addEdge({ ...params, id: `edge_${nextEdgeId++}`, type: 'custom', data: { label: '' } }, eds));
  }, [setEdges]);

  // 开始重连连线
  const startReconnect = useCallback((edgeId: string, end: 'source' | 'target') => {
    setReconnectingEdge({ id: edgeId, end });
    document.body.style.cursor = 'grabbing';
  }, []);

  // 取消重连
  const cancelReconnect = useCallback(() => {
    setReconnectingEdge(null);
    document.body.style.cursor = '';
  }, []);

  // 完成重连 - 连接到目标节点，支持锚点
  const completeReconnect = useCallback((targetNodeId: string, targetHandleId?: string) => {
    if (!reconnectingEdge) return;

    const edgeToUpdate = edges.find(e => e.id === reconnectingEdge.id);
    if (!edgeToUpdate) {
      cancelReconnect();
      return;
    }

    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === reconnectingEdge.id) {
          if (reconnectingEdge.end === 'source') {
            return {
              ...edge,
              source: targetNodeId,
              sourceHandle: targetHandleId || 'right'
            };
          } else {
            return {
              ...edge,
              target: targetNodeId,
              targetHandle: targetHandleId || 'left'
            };
          }
        }
        return edge;
      })
    );

    cancelReconnect();
  }, [reconnectingEdge, edges, cancelReconnect, setEdges]);

  // 监听全局鼠标事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!reconnectingEdge) return;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const nodeElement = elements.find(el => el.classList?.contains('react-flow__node'));

      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id');
        if (nodeId) {
          document.querySelectorAll('.react-flow__node').forEach(el => {
            el.classList.remove('reconnect-target');
          });
          nodeElement.classList.add('reconnect-target');
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!reconnectingEdge) return;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const nodeElement = elements.find(el => el.classList?.contains('react-flow__node'));
      const handleElement = elements.find(el => el.classList?.contains('react-flow__handle'));

      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id');
        let targetHandleId: string | undefined;

        if (handleElement) {
          targetHandleId = handleElement.getAttribute('data-handleid') || undefined;
        }

        if (nodeId) {
          completeReconnect(nodeId, targetHandleId);
        }
      }

      document.querySelectorAll('.react-flow__node').forEach(el => {
        el.classList.remove('reconnect-target');
      });
      cancelReconnect();
    };

    if (reconnectingEdge) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [reconnectingEdge, completeReconnect, cancelReconnect]);

  const addNode = () => {
    const newNodeId = `${nextNodeId++}`;
    setNodes((nds) => [...nds, {
      id: newNodeId,
      type: 'custom',
      data: { label: '新节点' },
      position: { x: Math.random() * 500 + 100, y: Math.random() * 400 + 100 }
    }]);
  };

  const onNodeDoubleClick = (_event: React.MouseEvent, node: Node) => {
    const newLabel = prompt('编辑节点名称', node.data.label as string);
    if (newLabel?.trim()) {
      setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel.trim() } } : n));
    }
  };

  const onNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setNodes((nds) => nds.filter((n) => n.id !== node.id));
    setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
  };

  // 保存到脑暴箱（如果是已加载的则覆盖，否则新建）
  const saveToBrainstormBox = async () => {
    let title = currentGraphName.current;
    let isNew = false;

    if (!currentGraphId.current) {
      title = prompt('请输入名称', currentGraphName.current);
      if (!title) return;
      isNew = true;
    }

    setLoading(true);
    try {
      // 检查重名（仅新建时检查，更新时不检查）
      if (isNew) {
        const exists = await checkDuplicateName(title, 'brainstorm');
        if (exists) {
          alert(`名称「${title}」已存在，请使用其他名称`);
          setLoading(false);
          return;
        }
      }

      if (currentGraphId.current && currentGraphBoxType.current === 'brainstorm') {
        await api.updateGraph(currentGraphId.current, title, nodes, edges, 'brainstorm');
        alert(`已更新脑暴箱中的「${title}」`);
      } else {
        await api.saveGraph(title, nodes, edges, 'brainstorm');
        alert(`已保存到脑暴箱：${title}`);
        currentGraphId.current = null;
        currentGraphBoxType.current = null;
      }
      currentGraphName.current = title;
      await loadAllBoxes();
      setShowSaveToBrainstormBtn(false);
      setPendingNodes([]);
      setPendingEdges([]);
      lastSavedContent.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    } catch (err) {
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存到草稿箱
  const saveToDraftBox = async (name?: string) => {
    let title = name || prompt('请输入名称', currentGraphName.current);
    if (!title) return;

    setLoading(true);
    try {
      // 检查重名
      const exists = await checkDuplicateName(title, 'draft');
      if (exists) {
        alert(`名称「${title}」已存在，请使用其他名称`);
        setLoading(false);
        return;
      }

      await api.saveGraph(title, nodes, edges, 'draft');
      currentGraphName.current = title;
      alert(`已保存到草稿箱！`);
      await loadAllBoxes();
      lastSavedContent.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    } catch (err) {
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 检查当前内容是否与最后保存的内容相同
  const isContentEqualToLastSaved = useCallback(() => {
    const lastNodes = lastSavedContent.current.nodes;
    const lastEdges = lastSavedContent.current.edges;

    if (lastNodes.length !== nodes.length || lastEdges.length !== edges.length) {
      return false;
    }

    const nodesMatch = nodes.every((node, i) => {
      const lastNode = lastNodes[i];
      return lastNode && node.id === lastNode.id && node.data.label === lastNode.data.label;
    });

    const edgesMatch = edges.every((edge, i) => {
      const lastEdge = lastEdges[i];
      return lastEdge && edge.id === lastEdge.id && edge.source === lastEdge.source && edge.target === lastEdge.target;
    });

    return nodesMatch && edgesMatch;
  }, [nodes, edges]);

  const newCanvas = async () => {
    const hasContent = nodes.length > 0 || edges.length > 0;
    const isContentSaved = isContentEqualToLastSaved();

    // 只有在有内容且未保存时才询问
    if (hasContent && !isContentSaved) {
      const action = confirm('当前画布有未保存的修改，是否先保存到草稿箱？\n\n点击「确定」保存\n点击「取消」放弃修改');
      if (action) {
        await saveToDraftBox();
      }
    }
    setNodes([]);
    setEdges([]);
    historyManager.current.clear();
    currentGraphName.current = '未命名';
    currentGraphId.current = null;
    currentGraphBoxType.current = null;
    pushToHistory([], []);
    setShowSaveToBrainstormBtn(false);
    setPendingNodes([]);
    setPendingEdges([]);
    lastSavedContent.current = { nodes: [], edges: [] };
  };

  const loadGraph = async (id: string, boxType: string) => {
    // 检查当前画布是否有未保存的内容
    const hasContent = nodes.length > 0 || edges.length > 0;
    const isContentSaved = isContentEqualToLastSaved();

    // 如果有未保存的内容，询问用户
    if (hasContent && !isContentSaved) {
      const action = confirm('当前画布有未保存的修改，是否先保存？\n\n点击「确定」保存当前内容\n点击「取消」放弃修改直接加载');

      if (action) {
        // 用户选择保存
        setLoading(true);
        try {
          if (currentGraphId.current && currentGraphBoxType.current) {
            // 有ID，直接覆盖保存
            await api.updateGraph(currentGraphId.current, currentGraphName.current, nodes, edges, currentGraphBoxType.current);
            alert(`已保存「${currentGraphName.current}」`);
          } else {
            // 没有ID，保存到草稿箱
            const title = prompt('请输入名称保存当前内容', currentGraphName.current);
            if (title) {
              await api.saveGraph(title, nodes, edges, 'draft');
              alert(`已保存到草稿箱：${title}`);
            }
          }
          await loadAllBoxes();
        } catch (err) {
          console.error('保存失败:', err);
          alert('保存失败，将直接加载新内容');
        } finally {
          setLoading(false);
        }
      }
    }

    // 清空画布
    setNodes([]);
    setEdges([]);
    historyManager.current.clear();

    // 加载新内容
    setLoading(true);
    try {
      const data = await api.loadGraph(id, boxType);
      let { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(data.nodes, data.edges, layoutDirection);
      layoutedEdges = fixEdgeAnchors(layoutedEdges, layoutDirection);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      currentGraphName.current = data.title;
      currentGraphId.current = id;
      currentGraphBoxType.current = boxType;
      pushToHistory(layoutedNodes, layoutedEdges);
      alert(`加载成功：${data.title}`);
      setShowBrainstormBox(false);
      setShowDraftBox(false);
      setShowRecycleBox(false);
      setShowSaveToBrainstormBtn(false);
      setPendingNodes([]);
      setPendingEdges([]);
      // 记录加载的内容为已保存状态
      lastSavedContent.current = { nodes: JSON.parse(JSON.stringify(layoutedNodes)), edges: JSON.parse(JSON.stringify(layoutedEdges)) };
    } catch (err) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const moveToRecycle = async (id: string, title: string, boxType: string) => {
    await api.moveToRecycle(id, title, boxType);
    await loadAllBoxes();
  };

  const restoreFromRecycle = async (id: string) => {
    await api.restoreFromRecycle(id);
    await loadAllBoxes();
  };

  const permanentDelete = async (id: string) => {
    await api.permanentDelete(id);
    await loadAllBoxes();
  };

  const loadAllBoxes = async () => {
    const [brainstorm, draft, recycle] = await Promise.all([
      api.listGraphs('brainstorm'),
      api.listGraphs('draft'),
      api.listGraphs('recycle')
    ]);
    setBrainstormList(brainstorm);
    setDraftList(draft);
    setRecycleList(recycle);
  };

  const handleTextAnalyze = async () => {
    if (!analyzeText.trim()) return;
    setAnalyzeLoading(true);

    try {
      const data = await api.analyzeText(analyzeText);

      // 确保节点ID是字符串
      const newNodes = data.nodes.map((n: any, idx: number) => ({
        id: String(n.id || `text_${Date.now()}_${idx}`),
        type: 'custom',
        data: { label: n.label.length > 30 ? n.label.substring(0, 28) + '...' : n.label },
        position: { x: 0, y: 0 },
      }));

      // 确保边的source和target正确对应节点ID
      const newEdges = data.edges.map((e: any, idx: number) => ({
        id: e.id || `text_edge_${Date.now()}_${idx}`,
        source: String(e.source),
        target: String(e.target),
        type: 'custom',
        data: { label: e.label || '' },
      }));

      // 合并节点和边
      let allNodes = [...nodes, ...newNodes];
      let allEdges = [...edges, ...newEdges];

      // 去重
      const uniqueNodes = Array.from(
        new Map(allNodes.map(n => [n.data.label, n])).values()
      );

      // 创建正确的ID映射
      const nodeIdMap = new Map();
      uniqueNodes.forEach((node) => {
        nodeIdMap.set(node.data.label, node.id);
      });

      // 更新边的引用，确保使用正确的ID
      const updatedEdges = newEdges.map(edge => {
        // 尝试通过label找到对应的节点ID
        const sourceNode = uniqueNodes.find(n => n.id === edge.source || n.data.label === edge.source);
        const targetNode = uniqueNodes.find(n => n.id === edge.target || n.data.label === edge.target);

        return {
          ...edge,
          source: sourceNode?.id || edge.source,
          target: targetNode?.id || edge.target,
        };
      });

      // 只使用新节点，不合并旧节点（避免混乱）
      let { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        uniqueNodes,
        updatedEdges,
        layoutDirection
      );

      layoutedEdges = fixEdgeAnchors(layoutedEdges, layoutDirection);

      // 直接替换，不清除旧内容
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setPendingNodes(layoutedNodes);
      setPendingEdges(layoutedEdges);
      setShowSaveToBrainstormBtn(true);

      setAnalyzeText('');
      setShowTextAnalyzer(false);

      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 100);
    } catch (err) {
      console.error('分析失败:', err);
      alert('分析失败: ' + (err as any).message);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // 添加边点击处理 - 确保只有当前点击的边被选中
  // 添加边点击处理 - 确保只有当前点击的边被选中
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: e.id === edge.id,
      }))
    );
  }, [setEdges]);

  const brainstormGenerate = async () => {
    if (!brainstormTopic.trim()) return;

    const topics = brainstormTopic.split(/[，,、\s\n]+/).filter(t => t.trim().length > 0);

    setBrainstormLoading(true);
    try {
      let data;

      if (topics.length > 1) {
        // 多个主题：发送给 AI 作为整体分析它们之间的关系
        const combinedTopic = topics.join('、');
        data = await api.brainstormGenerate(combinedTopic);
      } else {
        // 单个主题
        data = await api.brainstormGenerate(brainstormTopic);
      }

      const newNodes = data.nodes.map((n: any, idx: number) => ({
        id: n.id || `ai_${Date.now()}_${idx}`,
        type: 'custom',
        data: { label: n.label },
        position: { x: 0, y: 0 },
      }));

      const newEdges = data.edges.map((e: any, idx: number) => ({
        id: e.id || `ai_edge_${Date.now()}_${idx}`,
        source: e.source,
        target: e.target,
        type: 'custom',
        data: { label: e.label || '' },
      }));

      const allNodes = [...nodes, ...newNodes];
      const allEdges = [...edges, ...newEdges];
      let { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(allNodes, allEdges, layoutDirection);
      layoutedEdges = fixEdgeAnchors(layoutedEdges, layoutDirection);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setShowBrainstormInput(false);
      setBrainstormTopic('');
      setShowSaveToBrainstormBtn(true);
      setPendingNodes(layoutedNodes);
      setPendingEdges(layoutedEdges);

      alert(`✨ 生成成功！点击「保存到脑暴箱」按钮保存`);
    } catch (err) {
      console.error('脑暴失败:', err);
      alert('生成失败: ' + (err as any).message);
    } finally {
      setBrainstormLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodes.length || edges.length) pushToHistory(nodes, edges);
    }, 1000); // 1秒无操作才记录

    return () => clearTimeout(timer);
  }, [nodes, edges]);

  // 监听边选中事件
  useEffect(() => {
    const handleEdgeSelected = (event: CustomEvent) => {
      const { edgeId } = event.detail;
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: e.id === edgeId,
        }))
      );
    };

    window.addEventListener('edge-selected', handleEdgeSelected as EventListener);
    return () => {
      window.removeEventListener('edge-selected', handleEdgeSelected as EventListener);
    };
  }, [setEdges]);

  // 监听边重连开始事件
  useEffect(() => {
    const handleEdgeReconnectStart = (event: CustomEvent) => {
      const { edgeId, end } = event.detail;
      startReconnect(edgeId, end);
    };

    window.addEventListener('edge-reconnect-start', handleEdgeReconnectStart as EventListener);
    return () => {
      window.removeEventListener('edge-reconnect-start', handleEdgeReconnectStart as EventListener);
    };
  }, [startReconnect]);

  // 添加全局样式用于重连高亮
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .reconnect-target {
        box-shadow: 0 0 0 2px #f59e0b !important;
        transition: all 0.1s ease;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <style>{`
        .react-flow__pane {
          cursor: crosshair !important;
        }
        .react-flow__node {
          cursor: pointer !important;
        }
        .react-flow__edge {
          cursor: pointer !important;
        }
        .react-flow__edge-path {
          cursor: pointer !important;
        }
        .reconnect-target {
          box-shadow: 0 0 0 2px #f59e0b !important;
          transition: all 0.1s ease;
        }
      `}</style>

      <BoxModal title="🧠 脑暴箱" list={brainstormList} boxType="brainstorm" show={showBrainstormBox} onClose={() => setShowBrainstormBox(false)} onLoad={loadGraph} onMoveToRecycle={moveToRecycle} />
      <BoxModal title="📝 草稿箱" list={draftList} boxType="draft" show={showDraftBox} onClose={() => setShowDraftBox(false)} onLoad={loadGraph} onMoveToRecycle={moveToRecycle} />
      <BoxModal title="🗑️ 回收箱" list={recycleList} boxType="recycle" show={showRecycleBox} onClose={() => setShowRecycleBox(false)} onLoad={loadGraph} onRestore={restoreFromRecycle} onPermanentDelete={permanentDelete} />

      {showRestoreDialog && cachedData && (
        <div style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: 'white',
          padding: '20px 24px',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          minWidth: 320,
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>📋</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>发现未保存的草稿</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#666' }}>
                上次编辑时间：{new Date(cachedData.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={ignoreCache} style={{ padding: '6px 16px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>忽略</button>
            <button onClick={restoreFromCache} style={{ padding: '6px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>恢复草稿</button>
          </div>
        </div>
      )}

      {showBrainstormInput && (
        <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 200, background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', minWidth: 400 }}>
          <h3 style={{ margin: '0 0 12px 0' }}>🧠 AI 知识脑暴</h3>
          <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>输入主题，AI 将自动生成相关知识图谱</p>
          <input
            value={brainstormTopic}
            onChange={(e) => setBrainstormTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && brainstormGenerate()}
            placeholder="例如：人工智能、SpringCloud、React..."
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, marginBottom: 16 }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowBrainstormInput(false)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: 6, cursor: 'pointer' }}>取消</button>
            <button onClick={brainstormGenerate} disabled={brainstormLoading} style={{ padding: '8px 16px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              {brainstormLoading ? '生成中...' : '开始脑暴'}
            </button>
          </div>
        </div>
      )}

      {showTextAnalyzer && (
        <div style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 200,
          background: 'white',
          padding: 24,
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          minWidth: 500,
          maxWidth: 700,
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>📝 文本分析生成知识图谱</h3>
          <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>输入一段文字，AI 将自动分析其中的知识点和关系，生成知识脑暴图</p>
          <textarea
            value={analyzeText}
            onChange={(e) => setAnalyzeText(e.target.value)}
            placeholder={`例如：
人工智能是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。
机器学习是人工智能的一个子集，通过数据和算法让计算机自动学习和改进。
深度学习是机器学习的一个子集，使用多层神经网络来处理复杂的数据模式。`}
            rows={8}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 8,
              border: '1px solid #ccc',
              fontSize: 14,
              marginBottom: 16,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowTextAnalyzer(false)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: 6, cursor: 'pointer' }}>取消</button>
            <button onClick={handleTextAnalyze} disabled={analyzeLoading || !analyzeText.trim()} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, cursor: analyzeLoading || !analyzeText.trim() ? 'not-allowed' : 'pointer', opacity: analyzeLoading || !analyzeText.trim() ? 0.6 : 1 }}>
              {analyzeLoading ? '分析中...' : '开始分析生成'}
            </button>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        padding: '12px 20px',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🧠 AI 知识脑图</h2>

        <button onClick={() => setShowBrainstormInput(true)} style={{ padding: '6px 12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>✨ AI 脑暴</button>
        <button onClick={() => setShowTextAnalyzer(true)} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>📝 文本分析</button>

        {showSaveToBrainstormBtn && (
          <button onClick={saveToBrainstormBox} disabled={loading} style={{ padding: '6px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
            保存到脑暴箱
          </button>
        )}

        <div style={{ width: 1, height: 30, background: '#ccc' }} />

        <button onClick={newCanvas} style={{ padding: '6px 12px', background: '#64748b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>📄 新建</button>
        <button onClick={() => saveToDraftBox()} disabled={loading} style={{ padding: '6px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>保存到草稿箱</button>
        <button onClick={overwriteSave} disabled={loading} style={{ padding: '6px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>覆盖保存 (Ctrl+S)</button>
        <button onClick={addNode} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>新增节点</button>

        <div style={{ width: 1, height: 30, background: '#ccc' }} />

        <button onClick={() => { const state = historyManager.current.undo(); if (state) { isUndoRedo.current = true; setNodes(state.nodes); setEdges(state.edges); } }} disabled={!historyManager.current.hasUndo()} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: historyManager.current.hasUndo() ? 1 : 0.5 }}>↩ </button>
        <button onClick={() => { const state = historyManager.current.redo(); if (state) { isUndoRedo.current = true; setNodes(state.nodes); setEdges(state.edges); } }} disabled={!historyManager.current.hasRedo()} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: historyManager.current.hasRedo() ? 1 : 0.5 }}>↪</button>

        <div style={{ width: 1, height: 30, background: '#ccc' }} />

        <button onClick={() => { loadAllBoxes(); setShowBrainstormBox(true); }} style={{ padding: '6px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>脑暴箱</button>
        <button onClick={() => { loadAllBoxes(); setShowDraftBox(true); }} style={{ padding: '6px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>草稿箱</button>
        <button onClick={() => { loadAllBoxes(); setShowRecycleBox(true); }} style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>回收箱</button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges.map(edge => ({
          ...edge,
          data: { ...edge.data, onLabelSelect: handleLabelSelect }
        }))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        fitView
        connectionMode="loose"
        multiSelectionKeyCode={null}  // 添加这行，禁用多选
        selectionKeyCode={null}
        defaultEdgeOptions={{
          type: 'custom',
          markerEnd: {
            type: 'arrowclosed',
            color: '#8b5cf6',
            width: 20,
            height: 20,
          },
        }}
      >
        <Controls />
        <Background gap={16} color="#e2e8f0" />
      </ReactFlow>
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
}

export default App;