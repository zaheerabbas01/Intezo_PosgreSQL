import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const adminSocketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    
    if (!user || user.role !== 'admin') {
      return next(new Error('Admin access required'));
    }

    socket.userId = user.id;
    socket.userRole = user.role;
    socket.join('admin'); // Join admin room for broadcasts
    
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

export const handleAdminConnection = (socket) => {
  console.log(`Admin connected: ${socket.userId}`);
  
  // Send initial data
  socket.emit('admin_connected', {
    message: 'Connected to admin real-time updates',
    timestamp: new Date()
  });

  socket.on('disconnect', () => {
    console.log(`Admin disconnected: ${socket.userId}`);
  });
};