import type { Node, Edge } from 'reactflow';

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

export interface GraphItem {
  id: string;
  title: string;
  createdAt: string;
}