// Utility functions to replace alert() calls
export const showAlert = (message, type = 'info') => {
  // This will be replaced by notification context usage
  console.warn('Use useNotification hook instead of showAlert');
};

// Helper to replace window.confirm
export const showConfirm = (message, title = 'Confirm') => {
  return window.confirm(`${title}\n\n${message}`);
};

// Success message helper
export const showSuccess = (message) => {
  showAlert(message, 'success');
};

// Error message helper  
export const showError = (message) => {
  showAlert(message, 'error');
};

// Warning message helper
export const showWarning = (message) => {
  showAlert(message, 'warning');
};