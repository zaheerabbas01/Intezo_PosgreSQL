import React, { useEffect, useState } from 'react';
import '../styles/VerificationPopup.scss';

const VerificationPopup = ({ isOpen, onClose, onVerify, clinicId, userId, loading, userType = 'clinic' }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const verificationUserId = userId || clinicId;

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError('');
      setMessage('');
    }
  }, [isOpen, verificationUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setError('');
      setMessage('');
      await onVerify(verificationUserId, code);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Verification failed. Please try again.');
    }
  };

  const handleResend = async () => {
    try {
      setError('');
      setMessage('');
      if (userType === 'doctor') {
        const { resendDoctorVerification } = await import('../api/clinicApi');
        await resendDoctorVerification(verificationUserId);
      } else {
        const { resendClinicVerification } = await import('../api/clinicApi');
        await resendClinicVerification(verificationUserId);
      }
      setCode('');
      setMessage('A new verification code was sent. Only the newest code will work.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend verification code. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="verification-overlay">
      <div className="verification-popup">
        <h3>Email Verification</h3>
        <p>Please enter the 6-digit code sent to your email</p>
        
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        
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
            <button type="button" onClick={handleResend} disabled={loading || !verificationUserId}>
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
