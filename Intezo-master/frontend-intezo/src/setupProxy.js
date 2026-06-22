const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  const target = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
  console.log('Proxy target:', target);
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
  app.use(
    '/pusher/auth',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
    })
  );
};