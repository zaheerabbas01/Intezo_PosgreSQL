import axios from 'axios';
import { API_CONFIG } from '../config/api.js';

const API_BASE_URL = API_CONFIG.baseUrl;

const doctorApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
doctorApi.interceptors.request.use((config) => {
  const doctorData = localStorage.getItem('doctorUser');
  if (doctorData) {
    const { token } = JSON.parse(doctorData);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
doctorApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login for authentication errors, not authorization errors
      const errorMessage = error.response?.data?.message || error.response?.data?.error || '';
      const isAuthError = errorMessage.toLowerCase().includes('token') || 
                         errorMessage.toLowerCase().includes('expired') ||
                         errorMessage.toLowerCase().includes('invalid') ||
                         errorMessage.toLowerCase().includes('doctor access required') ||
                         errorMessage.toLowerCase().includes('email not verified');
      
      if (isAuthError) {
        localStorage.removeItem('doctorUser');
        window.location.href = '/doctor/login';
      }
    }
    return Promise.reject(error);
  }
);

export const registerDoctor = (doctorData) => {
  return doctorApi.post('/auth/register/doctor', doctorData);
};

export const loginDoctor = (email, password) => {
  return doctorApi.post('/auth/login/doctor', { email, password });
};

export const getDoctorProfile = (timestamp) => {
  const url = timestamp ? `/doctor/profile?t=${timestamp}` : '/doctor/profile';
  return doctorApi.get(url);
};

export const getDoctorStats = (timestamp) => {
  const url = timestamp ? `/doctor/stats?t=${timestamp}` : '/doctor/stats';
  return doctorApi.get(url);
};

export const joinClinic = (clinicId, clinicData) => {
  return doctorApi.post(`/doctor/join-clinic/${clinicId}`, clinicData);
};

export const leaveClinic = (clinicId) => {
  return doctorApi.delete(`/doctor/leave-clinic/${clinicId}`);
};

export const updateClinicSettings = (clinicId, settings) => {
  return doctorApi.put(`/doctor/clinic-settings/${clinicId}`, settings);
};

export const updateDoctorProfile = (profileData) => {
  return doctorApi.put('/doctor/profile', profileData);
};

export const toggleDoctorAvailability = (clinicId, isAvailable) => {
  return doctorApi.post('/doctors/toggle-availability', {
    clinicId,
    isAvailable
  });
};

export const getDoctorQueueStatus = (doctorId, timestamp) => {
  const url = timestamp ? `/doctors/${doctorId}/queue-status?t=${timestamp}` : `/doctors/${doctorId}/queue-status`;
  return doctorApi.get(url);
};

export default doctorApi;