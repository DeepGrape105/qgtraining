import axios from 'axios';

const API_URL = 'http://localhost:8081/api/graph';

export const api = {
  // 原有方法
  saveGraph: async (title: string, nodes: any[], edges: any[], boxType: string) => {
    const res = await axios.post(`${API_URL}/save`, { title, nodes, edges, boxType });
    return res.data;
  },

  loadGraph: async (id: string, boxType: string) => {
    const res = await axios.get(`${API_URL}/load/${id}?boxType=${boxType}`);
    return res.data;
  },

  listGraphs: async (boxType: string) => {
    const res = await axios.get(`${API_URL}/list?boxType=${boxType}`);
    return res.data;
  },

  moveToRecycle: async (id: string, title: string, boxType: string) => {
    await axios.post(`${API_URL}/moveToRecycle`, { id, boxType, title });
  },

  restoreFromRecycle: async (id: string) => {
    await axios.post(`${API_URL}/restoreFromRecycle`, { id });
  },

  permanentDelete: async (id: string) => {
    await axios.delete(`${API_URL}/permanentDelete/${id}`);
  },

  brainstormGenerate: async (topic: string) => {
    const res = await axios.get(`${API_URL}/generate?topic=${topic}`);
    return res.data;
  },

  // 新增：文本分析
  analyzeText: async (text: string) => {
    const res = await axios.post(`${API_URL}/analyze`, { text });
    return res.data;
  },
  updateGraph: async (id: string, title: string, nodes: any[], edges: any[], boxType: string) => {
    const res = await axios.put(`${API_URL}/update/${id}`, { title, nodes, edges, boxType });
    return res.data;
  },
};