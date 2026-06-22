import React from 'react';
import './Button.scss';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  disabled = false, 
  loading = false,
  onClick,
  type = 'button',
  className = '',
  ...props 
}) => {
  const buttonClass = `btn btn-${variant} btn-${size} ${loading ? 'btn-loading' : ''} ${className}`.trim();

  return (
    <button
      type={type}
      className={buttonClass}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <>
          <span className="btn-spinner"></span>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;