// In validatePusherAuth.js - add more detailed logging
export const validatePusherAuth = (req, res, next) => {
  console.log('Pusher auth request:', {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    query: req.query
  });

  // Check both body and query parameters
  const socketId = req.body?.socket_id || req.query?.socket_id;
  const channelName = req.body?.channel_name || req.query?.channel_name;

  if (!socketId) {
    console.error('Missing socket_id:', { body: req.body, query: req.query });
    return res.status(400).json({ error: "socket_id is required" });
  }

  if (!channelName) {
    console.error('Missing channel_name:', { body: req.body, query: req.query });
    return res.status(400).json({ error: "channel_name is required" });
  }

  req.pusherParams = { socketId, channelName };
  next();
};