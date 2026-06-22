import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { useNotification } from '../context/NotificationContext';
import { verifyDoctorEmail } from '../api/clinicApi';
import VerificationPopup from '../components/VerificationPopup';
import '../styles/Register.scss';

const DoctorRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    specialties: [''],
    qualifications: [{ degree: '', institution: '', year: '' }],
    licenseNumber: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const { register, completeAuthentication } = useDoctorAuth();
  const { showSuccess } = useNotification();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      const response = await register(formData);
      
      if (response.data.requiresVerification && response.data.pendingId) {
        setDoctorId(response.data.pendingId);
        setShowVerification(true);
        setError('');
      } else if (response.data && response.data.token) {
        navigate('/doctor/dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Doctor registration error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to register. Please try again.');
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
      } else if (response.data.status === 'pending_approval') {
        setShowVerification(false);
        setError('');
        showSuccess(response.data.message || 'Email verified. Your doctor registration is pending admin approval.');
        navigate('/doctor/login');
      } else {
        throw new Error('Unexpected verification response from server');
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
    <div className="register-container">
      <div className="register-card">
        <div className="logo">
          <h1>Intezo</h1>
        </div>
        <h2>Doctor Registration</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Dr. John Smith"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="doctor@example.com"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="+974 XXXX XXXX"
              />
            </div>
            <div className="form-group">
              <label>Specialties</label>
              {formData.specialties.map((specialty, index) => (
                <div key={index} className="specialty-input">
                  <select
                    value={specialty}
                    onChange={(e) => {
                      const newSpecialties = [...formData.specialties];
                      newSpecialties[index] = e.target.value;
                      setFormData({ ...formData, specialties: newSpecialties });
                    }}
                    required
                  >
                    <option value="">Select Specialty</option>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Psychiatry">Psychiatry</option>
                    <option value="Gynecology">Gynecology</option>
                    <option value="Ophthalmology">Ophthalmology</option>
                    <option value="ENT">ENT</option>
                    <option value="Other">Other</option>
                  </select>
                  {formData.specialties.length > 1 && (
                    <button type="button" onClick={() => {
                      const newSpecialties = formData.specialties.filter((_, i) => i !== index);
                      setFormData({ ...formData, specialties: newSpecialties });
                    }}>Remove</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => {
                setFormData({ ...formData, specialties: [...formData.specialties, ''] });
              }}>Add Specialty</button>
            </div>
          </div>

          <div className="form-group">
            <label>Qualifications</label>
            {formData.qualifications.map((qual, index) => (
              <div key={index} className="qualification-input">
                <input
                  type="text"
                  placeholder="Degree (e.g., MBBS, MD)"
                  value={qual.degree}
                  onChange={(e) => {
                    const newQuals = [...formData.qualifications];
                    newQuals[index].degree = e.target.value;
                    setFormData({ ...formData, qualifications: newQuals });
                  }}
                  required
                />
                <input
                  type="text"
                  placeholder="Institution"
                  value={qual.institution}
                  onChange={(e) => {
                    const newQuals = [...formData.qualifications];
                    newQuals[index].institution = e.target.value;
                    setFormData({ ...formData, qualifications: newQuals });
                  }}
                  required
                />
                <input
                  type="number"
                  placeholder="Year"
                  value={qual.year}
                  onChange={(e) => {
                    const newQuals = [...formData.qualifications];
                    newQuals[index].year = e.target.value;
                    setFormData({ ...formData, qualifications: newQuals });
                  }}
                  required
                />
                {formData.qualifications.length > 1 && (
                  <button type="button" onClick={() => {
                    const newQuals = formData.qualifications.filter((_, i) => i !== index);
                    setFormData({ ...formData, qualifications: newQuals });
                  }}>Remove</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => {
              setFormData({ ...formData, qualifications: [...formData.qualifications, { degree: '', institution: '', year: '' }] });
            }}>Add Qualification</button>
          </div>

          <div className="form-group">
            <label>Medical License Number</label>
            <input
              type="text"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              required
              placeholder="Enter your medical license number"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter password"
                minLength="6"
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm password"
                minLength="6"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="register-button"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <div className="login-link">
          <p>Already have an account?</p>
          <Link to="/doctor/login" className="login-button">
            Login Here
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

export default DoctorRegister;
