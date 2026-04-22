// API Configuration for Web Dashboard
export const API_CONFIG = {
  get baseUrl() {
    return process.env.REACT_APP_API_URL || 'https://api.intezo.online/api';
  }
};
