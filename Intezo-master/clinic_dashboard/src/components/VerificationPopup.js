import React, { useState } from 'react';
import '../styles/VerificationPopup.scss';

const VerificationPopup = ({ isOpen, onClose, onVerify, clinicId, loading }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    setError('');
    onVerify(clinicId, code);
  };

  const handleResend = async () => {
    try {
      const { resendClinicVerification } = await import('../api/clinicApi');
      await resendClinicVerification(clinicId);
      setError('');
      // Could add a success message here if needed
    } catch (err) {
      setError('Failed to resend verification code. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="verification-overlay">
      <div className="verification-popup">
        <h3>Email Verification</h3>
        <p>Please enter the 6-digit code sent to your email</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength="6"
            className="verification-input"
          />
          
          <div className="popup-buttons">
            <button type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={handleResend}>
              Resend Code
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerificationPopup;