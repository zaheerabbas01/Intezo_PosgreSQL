import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { verifyDoctorEmail } from '../api/clinicApi';
import VerificationPopup from '../components/VerificationPopup';
import '../styles/Login.scss';

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
      console.log('Doctor login attempt started');
      setError('');
      setLoading(true);
      
      const response = await login(email, password);
      console.log('Doctor login response:', response);
      
      // Check if verification is required
      if (response.data?.requiresVerification) {
        console.log('Verification required, doctorId:', response.data.doctorId);
        setDoctorId(response.data.doctorId);
        setShowVerification(true);
        setError('');
        return;
      }
      
      // If login is successful with token
      if (response.data && response.data.token) {
        console.log('Login successful, navigating to dashboard');
        navigate('/doctor/dashboard');
      } else {
        console.log('Invalid response, throwing error');
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.log('Doctor login error:', err);
      console.log('Error response:', err.response);
      console.log('Error data:', err.response?.data);
      
      const errorData = err.response?.data;
      
      // Handle 403 status with verification requirement
      if (err.response?.status === 403 && errorData?.requiresVerification && errorData?.doctorId) {
        console.log('Setting verification popup for doctorId:', errorData.doctorId);
        setDoctorId(errorData.doctorId);
        setShowVerification(true);
        setError('');
      } else if (errorData?.requiresVerification && errorData?.doctorId) {
        console.log('Setting verification popup for doctorId (fallback):', errorData.doctorId);
        setDoctorId(errorData.doctorId);
        setShowVerification(true);
        setError('');
      } else {
        console.log('Setting error message:', errorData?.error);
        setError(errorData?.error || 'Failed to log in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (doctorId, code) => {
    try {
      setLoading(true);
      const response = await verifyDoctorEmail(doctorId, code);
      
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
    <div className="login-container">
      <div className="login-card">
        <div className="logo">
          <h1>Intezo</h1>
        </div>
        <h2>Doctor Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="login-button"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="register-link">
          <p>Don't have an account?</p>
          <Link to="/doctor/register" className="register-button">
            Register as Doctor
          </Link>
        </div>
        
        <div className="back-link">
          <Link to="/" className="back-button">
            ← Back to Main Page
          </Link>
        </div>
      </div>
      
      <VerificationPopup
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onVerify={handleVerification}
        userId={doctorId}
        loading={loading}
        userType="doctor"
      />
    </div>
  );
};

export default DoctorLogin;
