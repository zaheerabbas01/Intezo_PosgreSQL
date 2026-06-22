// src/api/clinicApi.js
import axios from 'axios';
import { API_CONFIG } from '../config/api.js';

const API_BASE_URL = API_CONFIG.baseUrl;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const clinicUser = JSON.parse(localStorage.getItem('clinicUser') || '{}');
    
    // Use token from either source
    const authToken = token || clinicUser.token;
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login for authentication errors, not authorization errors
      const errorMessage = error.response?.data?.message || error.response?.data?.error || '';
      const isAuthError = errorMessage.toLowerCase().includes('token') || 
                         errorMessage.toLowerCase().includes('expired') ||
                         errorMessage.toLowerCase().includes('invalid') ||
                         errorMessage.toLowerCase().includes('unauthorized access');
      
      if (isAuthError) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('clinicUser');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Clinic API functions
export const registerClinic = (data) => {
  return api.post('/auth/register/clinic', data);
};

export const loginClinic = (email, password) => {
  console.log('API call to:', `${API_BASE_URL}/auth/login/clinic`);
  return api.post('/auth/login/clinic', { email, password });
};

export const verifyClinicEmail = (clinicId, verificationCode) => {
  return api.post('/auth/verify/clinic', { clinicId, verificationCode });
};

export const resendClinicVerification = (clinicId) => {
  return api.post('/auth/resend/clinic', { clinicId });
};

// Doctor auth functions
export const registerDoctor = (data) => {
  return api.post('/auth/register/doctor', data);
};

export const loginDoctor = (email, password) => {
  console.log('Doctor login API call:', `${API_BASE_URL}/auth/login/doctor`);
  return api.post('/auth/login/doctor', { email, password });
};

export const verifyDoctorEmail = (doctorId, verificationCode) => {
  return api.post('/auth/verify/doctor', { doctorId, verificationCode });
};

export const resendDoctorVerification = (doctorId) => {
  return api.post('/auth/resend/doctor', { doctorId });
};

export const getClinicProfile = () => {
  return api.get('/clinics/profile');
};

export const updateClinicProfile = (data) => {
  return api.put('/clinics/profile', data);
};

export const toggleClinicStatus = () => {
  return api.post('/clinics/toggle-status');
};

export const getClinicStatus = () => {
  return api.get('/clinics/status');
};

export const getQueueAnalytics = () => {
  return api.get('/clinics/analytics');
};

export const debugQueueStatus = () => {
  return api.get('/clinics/debug-queue');
};

// Queue API functions - Updated for doctor-specific queues
export const getDoctorQueue = (clinicId, doctorId) => {
  return api.get(`/queues/${clinicId}/${doctorId}`);
};

export const getPublicDoctorQueue = (clinicId, doctorId, timestamp) => {
  const url = timestamp ? `/queues/public/${clinicId}/${doctorId}?t=${timestamp}` : `/queues/public/${clinicId}/${doctorId}`;
  return api.get(url);
};

export const updateCurrentNumber = (data) => {
  return api.post('/queues/next', data);
};

export const updateToSpecificNumber = (doctorId, newNumber) => {
  return api.post('/queues/next', { 
    doctorId, 
    action: 'specific', 
    newNumber 
  });
};

export const callNextPatient = (doctorId) => {
  return api.post('/queues/next', { 
    doctorId, 
    action: 'next' 
  });
};

// Doctor API functions
export const getDoctors = () => {
  return api.get('/doctors');
};

export const getDoctor = (id) => {
  return api.get(`/doctors/${id}`);
};

export const createDoctor = (doctorData) => {
  return api.post('/doctors', doctorData);
};

export const updateDoctor = (id, doctorData) => {
  return api.put(`/doctors/${id}`, doctorData);
};

export const deleteDoctor = (id) => {
  return api.delete(`/doctors/${id}`);
};

export const toggleDoctorAvailability = (id, isAvailable) => {
  return api.patch(`/doctors/${id}/availability`, { isAvailable });
};

export const getDoctorQueueStatus = (doctorId, timestamp, clinicId) => {
  return api.get(`/doctors/${doctorId}/queue-status`, {
    params: {
      ...(timestamp ? { t: timestamp } : {}),
      ...(clinicId ? { clinicId } : {})
    },
    timeout: 15000
  });
};

export const getAvailableDoctors = () => {
  return api.get('/doctors/available');
};

export const addDoctorToClinic = (doctorData) => {
  return api.post('/doctors/add-to-clinic', doctorData);
};

// Patient API functions
export const updatePatient = (patientId, data) => {
  return api.put(`/patients/${patientId}`, data);
};

export const getPatientHistory = (patientId) => {
  return api.get(`/clinics/patients/${patientId}/history`);
};

export const addPatientToQueue = (data) => {
  return api.post('/clinics/add-patient-to-queue', data);
};

export const bookDoctorQueue = (clinicId, doctorId, patientData) => {
  return api.post('/queue/book', {
    clinicId,
    doctorId,
    ...patientData
  });
};

// Public API functions (no auth required)
export const getPublicClinics = () => {
  return api.get('/clinics/public');
};

export const getPublicDoctors = (clinicId) => {
  return api.get(`/doctors/public/${clinicId}`);
};

export const getClinicPublicStatus = (clinicId) => {
  return api.get(`/clinic/${clinicId}/status`);
};

// Report API functions
export const createPatientReport = (reportData) => {
  return api.post('/reports', reportData);
};

export const getClinicReports = (params = {}) => {
  return api.get('/reports/clinic', { params });
};

export const downloadReport = (reportId) => {
  return api.get(`/reports/${reportId}/download`, {
    responseType: 'blob'
  });
};

export default api;
