import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyClinicEmail } from '../api/clinicApi';
import VerificationPopup from '../components/VerificationPopup';
import '../styles/Login.scss';

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
      
      // Check if verification is required
      if (response.data?.requiresVerification) {
        setClinicId(response.data.clinicId);
        setShowVerification(true);
        setError('');
        return;
      }
      
      // If login is successful with token
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

  const handleVerification = async (clinicId, code) => {
    try {
      setLoading(true);
      const response = await verifyClinicEmail(clinicId, code);
      
      if (response.data.token) {
        // Store both token and clinic data
        localStorage.setItem('token', response.data.token);
        const clinicUser = {
          token: response.data.token,
          clinic: response.data.clinic
        };
        localStorage.setItem('clinicUser', JSON.stringify(clinicUser));
        
        // Update auth context
        setUserAfterVerification(clinicUser);
        
        navigate('/clinic/dashboard');
      } else {
        setError('Verification successful but no token received');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo">
          <h1>Clinic Queue System</h1>
        </div>
        <h2>Clinic Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your clinic email"
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
          <Link to="/clinic/register" className="register-button">
            Register Your Clinic
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
        clinicId={clinicId}
        loading={loading}
      />
    </div>
  );
};

export default Login;