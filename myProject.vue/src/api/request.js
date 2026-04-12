import axios from 'axios';

// 全局唯一真相源
export const SERVER_HOST = 'http://localhost:3000';

const instance = axios.create({
  baseURL: `${SERVER_HOST}/api`,
  timeout: 10000, // 10秒超时
});

// 请求拦截器：自动注入固定 Token
instance.interceptors.request.use(
  (config) => {
    config.headers['Authorization'] = 'Bearer QG_Canvas_2026';
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一错误处理
instance.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (!res.success) {
      alert(res.message || '操作失败');
      return Promise.reject(new Error(res.message));
    }
    return res.data; // 直接返回核心数据
  },
  (error) => {
    if (error.response?.status === 401) {
      alert('暂无权限，请检查 Token！');
    } else if (error.response?.status >= 500) {
      alert('服务器挂了，请稍后再试！');
    }
    return Promise.reject(error);
  }
);

/**
 * 资产路径转换工具
 */
export const getFullAssetUrl = (url) => {
  if (!url) return '';
  // 如果是 cloudinary 的链接 (http/https开头)，直接返回
  if (url.startsWith('http')) return url;
  // 兼容以前可能存在的本地路径（可选）
  return `${SERVER_HOST}${url}`;
};
export default instance;