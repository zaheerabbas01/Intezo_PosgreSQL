import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { verifyDoctorEmail } from '../api/clinicApi';
import AuthShell from '../components/Auth/AuthShell';
import VerificationPopup from '../components/VerificationPopup';

const DoctorLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const { login, completeAuthentication } = useDoctorAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);

      const response = await login(email, password);

      if (response.data?.requiresVerification) {
        setDoctorId(response.data.doctorId);
        setShowVerification(true);
        setError('');
        return;
      }

      if (response.data && response.data.token) {
        navigate('/doctor/dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const errorData = err.response?.data;

      if (errorData?.requiresVerification && errorData?.doctorId) {
        setDoctorId(errorData.doctorId);
        setShowVerification(true);
        setError('');
      } else {
        setError(errorData?.error || 'Failed to log in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (doctorIdToVerify, code) => {
    try {
      setLoading(true);
      const response = await verifyDoctorEmail(doctorIdToVerify, code);

      if (response.data.token) {
        completeAuthentication(response.data.token, response.data.doctor);
        navigate('/doctor/dashboard');
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
      role="Doctor portal"
      title="Welcome back, doctor."
      intro="See your assigned clinics and move through each live patient queue."
      asideTitle="The next patient, without the noise."
      asideBody="A focused workspace for doctors who need the right queue and the right patient at the right moment."
      asideItems={[
        'Switch between assigned clinics',
        'See who is waiting and who is next',
        'Update every connected screen at once'
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
            placeholder="Your work email"
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
        <Link to="/doctor/register">Register as a doctor</Link>
      </div>

      <VerificationPopup
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onVerify={handleVerification}
        userId={doctorId}
        loading={loading}
        userType="doctor"
      />
    </AuthShell>
  );
};

export default DoctorLogin;
