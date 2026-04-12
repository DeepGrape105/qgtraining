CREATE DATABASE IF NOT EXISTS qg_canvas DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci
USE qg_canvas

-- 1. 画布主表
CREATE TABLE IF NOT EXISTS canvases (
  id VARCHAR(64) PRIMARY KEY COMMENT '画布唯一标识',
  content LONGTEXT COMMENT 'elements数组序列化后的JSON',
  config TEXT COMMENT '画布全局配置JSON',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)

-- 2. 历史快照表 
CREATE TABLE IF NOT EXISTS snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  canvas_id VARCHAR(64) NOT NULL,
  content LONGTEXT COMMENT '备份的 elements 数据',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_canvas_id (canvas_id)
)

-- 插入一条初始测试数据，以便前端第一次请求时有数据可拿
INSERT INTO canvases (id, content, config) 
VALUES ('1', '[]', '{"width": 800, "height": 600, "backgroundColor": "#ffffff"}')