// utils/queryOptimizer.js - Query optimization utilities
import sequelize from '../config/database.js';
import { Op } from 'sequelize';
import Queue from '../models/Queue.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';

export class QueryOptimizer {
  // Optimized queue queries
  static async getWaitingQueues(clinicId, doctorId = null, limit = 10) {
    const where = {
      clinicId: clinicId,
      status: 'waiting'
    };
    
    if (doctorId) {
      where.doctorId = doctorId;
    }

    return await Queue.findAll({
      where,
      order: [['number', 'ASC']],
      limit,
      attributes: ['number', 'patientName', 'patientId', 'manualEntry'],
      include: [{
        model: Patient,
        as: 'patient',
        attributes: ['name']
      }],
      raw: false
    });
  }

  // Optimized patient lookup
  static async findPatientByEmail(email) {
    return await Patient.findOne({
      where: { email: email.toLowerCase() },
      attributes: ['name', 'email', 'phone', 'isPremium', 'premiumExpiresAt'],
      raw: true
    });
  }

  // Optimized doctor availability check
  static async getAvailableDoctors(clinicId) {
    return await Doctor.findAll({
      where: {
        clinics: {
          [Op.contains]: [{ clinic: clinicId, isActive: true, isAvailable: true }]
        }
      },
      attributes: ['name', 'specialties'],
      raw: false
    });
  }

  // Batch queue operations
  static async batchUpdateQueueStatus(queueIds, status, additionalFields = {}) {
    const updateFields = { status, ...additionalFields };
    
    return await Queue.update(
      updateFields,
      { where: { id: { [Op.in]: queueIds } } }
    );
  }

  // Performance monitoring
  static async analyzeSlowQueries() {
    // PostgreSQL query performance analysis
    const slowQueries = await sequelize.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        max_time
      FROM pg_stat_statements
      WHERE mean_time > 100
      ORDER BY mean_time DESC
      LIMIT 10
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('📊 Query profiling enabled for operations >100ms');
    return slowQueries;
  }

  // Index usage statistics
  static async getIndexStats(tableName) {
    const stats = await sequelize.query(`
      SELECT 
        indexrelname as index_name,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      WHERE relname = :tableName
      ORDER BY idx_scan DESC
    `, {
      replacements: { tableName },
      type: sequelize.QueryTypes.SELECT
    });
    
    return stats;
  }
}

// Middleware for query performance monitoring
export const queryPerformanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) { // Log slow requests >1s
      console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
};