const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  const target = 'https://api.intezo.online';
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