import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import redisClient from './redis.js';
// import { adminSocketAuth, handleAdminConnection } from '../middleware/adminSocket.js';
import 'dotenv/config';

let io;

export const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3001",
        "https://web.intezo.online",
        /\.intezo\.online$/,
        "*"
      ],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["*"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 10000,
    upgradeTimeout: 10000,
    allowEIO3: true,
    allowUpgrades: true,
    maxHttpBufferSize: 1e6
  });

  // Only set up Redis adapter if Redis is available
  try {
    if (redisClient.isOpen) {
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();
      
      await pubClient.connect();
      await subClient.connect();
      
      io.adapter(createAdapter(pubClient, subClient));
    }
  } catch (error) {
    console.error('❌ Failed to set up Redis adapter:', error.message);
  }

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                  socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userType = decoded.role || 'clinic';
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Admin namespace for admin-specific real-time features
  const adminNamespace = io.of('/admin');
  adminNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token provided'));
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      if (decoded.role !== 'admin') return next(new Error('Admin access required'));
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });
  
  adminNamespace.on('connection', (socket) => {
    socket.join('admin');
    socket.emit('admin_connected', { message: 'Connected to admin real-time updates' });
    
    socket.on('disconnect', () => {
      // Silent
    });
  });

  io.on('connection', (socket) => {
    // Join user-specific room
    socket.join(`user_${socket.userId}`);
    
    // Join admin room if user is admin
    if (socket.userType === 'admin') {
      socket.join('admin');
    }
    
    // Handle clinic/doctor room joining
    socket.on('join_clinic', (clinicId) => {
      socket.join(`clinic_${clinicId}`);
      socket.emit('joined_clinic', clinicId);
    });

    socket.on('join_doctor', (doctorId) => {
      socket.join(`doctor_${doctorId}`);
      socket.emit('joined_doctor', doctorId);
    });

    socket.on('join_patient', (patientId) => {
      socket.join(`patient_${patientId}`);
      socket.emit('joined_patient', patientId);
    });

    // Real-time events
    socket.on('queue_update', (data) => {
      socket.to(`clinic_${data.clinicId}`).emit('queue_updated', data);
    });

    socket.on('doctor_status', (data) => {
      socket.to(`clinic_${data.clinicId}`).emit('doctor_status_changed', data);
    });

    socket.on('disconnect', async () => {
      // Silent - users remain logged in until explicit logout
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const emitToClinic = (clinicId, event, data) => {
  try {
    if (io) {
      io.to(`clinic_${clinicId}`).emit(event, data);
    }
  } catch (error) {
    console.error('❌ Error emitting to clinic:', error.message);
  }
};

export const emitToDoctor = (doctorId, event, data) => {
  try {
    if (io) {
      io.to(`doctor_${doctorId}`).emit(event, data);
    }
  } catch (error) {
    console.error('❌ Error emitting to doctor:', error.message);
  }
};

export const emitToUser = (userId, event, data) => {
  try {
    if (io) {
      io.to(`user_${userId}`).emit(event, data);
    }
  } catch (error) {
    console.error('❌ Error emitting to user:', error.message);
  }
};

export const emitToPatient = (patientId, event, data) => {
  try {
    if (io) {
      io.to(`patient_${patientId}`).emit(event, data);
    }
  } catch (error) {
    console.error('❌ Error emitting to patient:', error.message);
  }
};

export const emitToAdmin = (event, data) => {
  try {
    if (io) {
      io.to('admin').emit(event, data);
      io.of('/admin').emit(event, data);
    }
  } catch (error) {
    console.error('❌ Error emitting to admin:', error.message);
  }
};

export default { initializeSocket, getIO, emitToClinic, emitToDoctor, emitToUser };