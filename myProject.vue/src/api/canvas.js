import request from './request';

/**
 * 保存当前画布状态到云端
 */
export const saveCanvasApi = (canvasId, elements, config) => {
  return request.put(`/canvas/${canvasId}`, {
    elements,
    config
  });
};

/**
 * 获取云端最新画布数据
 */
export const getLatestCanvasApi = (canvasId) => {
  return request.get(`/canvas/${canvasId}`);
};

/**
 * 获取历史快照列表
 */
export const getHistoryListApi = (canvasId) => {
  return request.get(`/canvas/${canvasId}/history`);
};

/**
 * 获取指定快照的完整画布数据
 * @param {string} canvasId 画布ID
 * @param {string|number} snapshotId 快照ID
 */
export const getSnapshotDataApi = (canvasId, snapshotId) => {
  return request.get(`/canvas/${canvasId}/snapshot/${snapshotId}`);
};