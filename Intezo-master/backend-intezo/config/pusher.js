import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import redisClient from './redis.js';
import { Op } from 'sequelize';
import { Doctor, Queue } from '../models/index.js';
// import { adminSocketAuth, handleAdminConnection } from '../middleware/adminSocket.js';
import 'dotenv/config';

let io;

const allowedOrigins = (process.env.FRONTEND_URL || 'https://web.intezo.online')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const socketOriginAllowed = (origin, callback) => {
  // Native mobile clients do not send a browser Origin header.
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed'));
};

const doctorBelongsToClinic = (doctor, clinicId) => (doctor?.clinics || []).some((association) => {
  const associatedClinicId = association?.clinicId || association?.clinic || association?.id || association;
  return String(associatedClinicId) === String(clinicId);
});

const hasActiveQueue = async (where) => Boolean(await Queue.findOne({
  where: { ...where, status: { [Op.in]: ['waiting', 'skipped'] } },
  attributes: ['id']
}));

const canAccessClinicRoom = async (socket, clinicId) => {
  if (socket.userType === 'admin') return true;
  if (socket.userType === 'clinic') return String(socket.userId) === String(clinicId);
  if (socket.userType === 'doctor') {
    const doctor = await Doctor.findByPk(socket.userId, { attributes: ['clinics'] });
    return doctorBelongsToClinic(doctor, clinicId);
  }
  if (socket.userType === 'patient') {
    return hasActiveQueue({ patientId: socket.userId, clinicId });
  }
  return false;
};

const canAccessDoctorRoom = async (socket, doctorId) => {
  if (socket.userType === 'admin') return true;
  if (socket.userType === 'doctor') return String(socket.userId) === String(doctorId);
  if (socket.userType === 'clinic') {
    const doctor = await Doctor.findByPk(doctorId, { attributes: ['clinics'] });
    return doctorBelongsToClinic(doctor, socket.userId);
  }
  if (socket.userType === 'patient') {
    return hasActiveQueue({ patientId: socket.userId, doctorId });
  }
  return false;
};

const canAccessPatientRoom = async (socket, patientId) => {
  if (socket.userType === 'admin') return true;
  if (socket.userType === 'patient') return String(socket.userId) === String(patientId);
  if (socket.userType === 'clinic') return hasActiveQueue({ patientId, clinicId: socket.userId });
  if (socket.userType === 'doctor') return hasActiveQueue({ patientId, doctorId: socket.userId });
  return false;
};

const joinAuthorizedRoom = async (socket, roomType, roomId, authorize, callback) => {
  try {
    if (!roomId || !(await authorize(socket, roomId))) {
      socket.emit('authorization_error', { roomType, message: 'Not authorized to join this room' });
      callback?.({ ok: false, error: 'Not authorized' });
      return;
    }
    socket.join(`${roomType}_${roomId}`);
    socket.emit(`joined_${roomType}`, roomId);
    callback?.({ ok: true });
  } catch (error) {
    console.error(`Socket room authorization failed for ${roomType}:`, error.message);
    callback?.({ ok: false, error: 'Authorization failed' });
  }
};

export const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: socketOriginAllowed,
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Authorization", "Content-Type"]
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
    socket.on('join_clinic', (clinicId, callback) => {
      joinAuthorizedRoom(socket, 'clinic', clinicId, canAccessClinicRoom, callback);
    });

    socket.on('join_doctor', (doctorId, callback) => {
      joinAuthorizedRoom(socket, 'doctor', doctorId, canAccessDoctorRoom, callback);
    });

    socket.on('join_patient', (patientId, callback) => {
      joinAuthorizedRoom(socket, 'patient', patientId, canAccessPatientRoom, callback);
    });

    // Real-time events
    socket.on('queue_update', async (data = {}) => {
      if (!['clinic', 'doctor'].includes(socket.userType)) return;
      if (!(await canAccessClinicRoom(socket, data.clinicId))) return;
      socket.to(`clinic_${data.clinicId}`).emit('queue_updated', data);
    });

    socket.on('doctor_status', async (data = {}) => {
      if (!['clinic', 'doctor'].includes(socket.userType)) return;
      if (!(await canAccessClinicRoom(socket, data.clinicId))) return;
      if (socket.userType === 'doctor' && String(socket.userId) !== String(data.doctorId)) return;
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

export const closeSocket = async () => {
  if (!io) return;
  await new Promise((resolve) => io.close(resolve));
  io = undefined;
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
