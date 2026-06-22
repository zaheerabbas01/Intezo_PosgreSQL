import { API_CONFIG } from '../config/api';

// Authentication utility functions
export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const isAuthenticated = () => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic token format check
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Check if token is expired (basic check)
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Date.now() / 1000;
    
    if (payload.exp && payload.exp < currentTime) {
      localStorage.removeItem('token');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Invalid token format:', error);
    localStorage.removeItem('token');
    return false;
  }
};

export const getUserRole = () => {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.role;
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
};

export const handleApiError = (error, response = null) => {
  console.error('API Error:', error);
  
  if (response) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      return 'Authentication failed. Please log in again.';
    } else if (response.status === 403) {
      return 'Access denied. You do not have permission to perform this action.';
    } else if (response.status >= 500) {
      return 'Server error. Please try again later.';
    }
  }
  
  if (error.message.includes('Failed to fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  return 'An unexpected error occurred. Please try again.';
};

export const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  const requestOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };
  
  try {
    const requestUrl = url.startsWith('/api/')
      ? `${API_CONFIG.baseUrl}${url.slice('/api'.length)}`
      : url;
    const response = await fetch(requestUrl, requestOptions);
    
    // Response should be JSON from API
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    return await response.json();
  } catch (error) {
    if (error.status === 401) {
      localStorage.removeItem('token');
    }
    throw error;
  }
};
