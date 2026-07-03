import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyClinicEmail } from '../api/clinicApi';
import AuthShell from '../components/Auth/AuthShell';
import VerificationPopup from '../components/VerificationPopup';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [clinicId, setClinicId] = useState('');
  const { login, setUserAfterVerification } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);

      const response = await login(email, password);

      if (response.data?.requiresVerification) {
        setClinicId(response.data.clinicId);
        setShowVerification(true);
        setError('');
        return;
      }

      if (response.data && response.data.token) {
        navigate('/clinic/dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const errorData = err.response?.data;

      if (errorData?.requiresVerification && errorData?.clinicId) {
        setClinicId(errorData.clinicId);
        setShowVerification(true);
        setError('');
      } else {
        setError(errorData?.error || 'Failed to log in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (clinicIdToVerify, code) => {
    try {
      setLoading(true);
      const response = await verifyClinicEmail(clinicIdToVerify, code);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        const clinicUser = {
          token: response.data.token,
          clinic: response.data.clinic
        };
        localStorage.setItem('clinicUser', JSON.stringify(clinicUser));
        setUserAfterVerification(clinicUser);
        navigate('/clinic/dashboard');
      } else {
        setError('Verification successful but no token received');
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Verification failed';
      setError(message);
      throw err.response?.data?.error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      role="Clinic portal"
      title="Sign in to your clinic."
      intro="Open today’s queues, manage your team and keep patients informed."
      asideTitle="One queue. One clear view."
      asideBody="Everything your front desk needs to keep a busy clinic moving without losing track of who is next."
      asideItems={[
        'See every active doctor queue',
        'Call and update patients in real time',
        'Review the day from one dashboard'
      ]}
    >
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Your clinic email"
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Your password"
          />
        </div>
        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth-switch">
        <p>New to Intezo?</p>
        <Link to="/clinic/register">Register your clinic</Link>
      </div>

      <VerificationPopup
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onVerify={handleVerification}
        clinicId={clinicId}
        loading={loading}
      />
    </AuthShell>
  );
};

export default Login;
