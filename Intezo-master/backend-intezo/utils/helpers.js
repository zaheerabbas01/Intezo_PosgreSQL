import { emitToAdmin } from '../config/pusher.js';

export const logActivity = async (type, message, userId = null) => {
  console.log(`[Activity] ${type}: ${message}${userId ? ` (user: ${userId})` : ''}`);
};

export const publishAdminUpdate = async (event, data) => {
  try {
    emitToAdmin(event, data);
  } catch (err) {
    console.warn('Admin broadcast skipped:', err.message);
  }
};
