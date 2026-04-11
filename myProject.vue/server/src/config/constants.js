//负责配置权限鉴权令牌和上传图片的限制
module.exports = {
  STATIC_TOKEN: "QG_Canvas_2026", // 固定鉴权令牌
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, 
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg']
};