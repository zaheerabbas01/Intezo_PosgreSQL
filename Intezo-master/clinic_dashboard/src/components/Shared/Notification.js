import React, { useEffect, useState } from 'react';
import './Notification.scss';

const Notification = ({ message, type = 'info', onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose && onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className={`notification ${type}`}>
      <span>{message}</span>
      <button onClick={() => {
        setVisible(false);
        onClose && onClose();
      }}>×</button>
    </div>
  );
};

export default Notification;