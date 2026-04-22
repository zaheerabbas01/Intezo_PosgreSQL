import React from 'react';
import './Toast.scss';

const Toast = ({ message, type = 'info', onClose, position = 'bottom-right' }) => {
  return (
    <div className={`toast toast-${type} toast-${position}`}>
      <div className="toast-content">
        <span className="toast-message">{message}</span>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

export default Toast;