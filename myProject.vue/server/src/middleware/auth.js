const { STATIC_TOKEN } = require('../config/constants');

/**
 * 简易鉴权中间件
 */
const validateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // 判断逻辑：不符合 Bearer QG_Canvas_2026 则拦截
  if (!authHeader || authHeader !== `Bearer ${STATIC_TOKEN}`) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  next(); // 校验通过，进入后续业务逻辑
};

module.exports = { validateToken };