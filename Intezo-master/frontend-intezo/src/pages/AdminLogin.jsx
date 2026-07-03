import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import AuthShell from '../components/Auth/AuthShell';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('email');
  const [adminId, setAdminId] = useState('');
  const { login, verifyCode } = useAdminAuth();
  const navigate = useNavigate();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await login(email);
      setAdminId(data.adminId);
      setStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verifyCode(adminId, verificationCode);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      role="Administration"
      title={step === 'email' ? 'Request a sign-in code.' : 'Enter your sign-in code.'}
      intro={
        step === 'email'
          ? 'Administrator access uses a one-time code sent to an approved email address.'
          : `We sent a six-digit code to ${email}.`
      }
      asideTitle="Sensitive access should stay simple and deliberate."
      asideBody="Intezo administration is separated from clinic and doctor accounts and protected by email verification."
      asideItems={[
        'Approved administrators only',
        'Short-lived email verification',
        'No reusable admin password'
      ]}
    >
      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="auth-form">
          <div className="form-group">
            <label>Administrator email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Approved email address"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? 'Sending code…' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifySubmit} className="auth-form">
          <div className="form-group">
            <label>Six-digit verification code</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              maxLength="6"
              required
            />
          </div>
          <p className="info-text">Check your email and enter the newest code.</p>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? 'Verifying…' : 'Verify and sign in'}
          </button>
          <button type="button" onClick={() => setStep('email')} className="admin-secondary-button">
            Use a different email
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default AdminLogin;
