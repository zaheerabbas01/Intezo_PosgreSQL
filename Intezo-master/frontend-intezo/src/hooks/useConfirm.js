import { useState } from 'react';

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'default'
  });

  const confirm = ({ title, message, onConfirm, type = 'default' }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          onConfirm?.();
          resolve(true);
        },
        type
      });
    });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  return { confirmState, confirm, closeConfirm };
};