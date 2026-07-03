import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerClinic, verifyClinicEmail } from '../api/clinicApi';
import { useNotification } from '../context/NotificationContext';
import AuthShell from '../components/Auth/AuthShell';
import VerificationPopup from '../components/VerificationPopup';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    services: ['General Consultation'],
    operatingHours: {
      opening: '09:00',
      closing: '17:00'
    }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [clinicId, setClinicId] = useState('');
  const navigate = useNavigate();
  const { showSuccess } = useNotification();

  const serviceOptions = [
    'General Consultation',
    'Dental Care',
    'Pediatrics',
    'Dermatology',
    'Cardiology',
    'Orthopedics',
    'Ophthalmology',
    'Gynecology',
    'Neurology',
    'Emergency Care'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleServiceChange = (service) => {
    const currentServices = formData.services;

    if (currentServices.includes(service)) {
      setFormData({
        ...formData,
        services: currentServices.filter((item) => item !== service)
      });
    } else {
      setFormData({
        ...formData,
        services: [...currentServices, service]
      });
    }
  };

  const handleTimeChange = (field, value) => {
    setFormData({
      ...formData,
      operatingHours: {
        ...formData.operatingHours,
        [field]: value
      }
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

      const response = await registerClinic({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        services: formData.services,
        operatingHours: formData.operatingHours
      });

      if (response.data.requiresVerification && response.data.pendingId) {
        setClinicId(response.data.pendingId);
        setShowVerification(true);
        setError('');
      } else if (response.data && response.data.token) {
        localStorage.setItem('clinicUser', JSON.stringify({
          token: response.data.token,
          clinic: response.data.clinic
        }));
        navigate('/clinic/dashboard');
      } else {
        setError('Registration completed but login failed. Please try logging in.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (clinicIdToVerify, code) => {
    try {
      setLoading(true);
      const response = await verifyClinicEmail(clinicIdToVerify, code);

      if (response.data.status === 'pending_approval') {
        setShowVerification(false);
        setError('');
        showSuccess('Email verified successfully! Your registration is now pending admin approval. You will be notified once approved.');
        navigate('/clinic/login');
      } else if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('clinicUser', JSON.stringify(response.data.clinic));
        navigate('/clinic/dashboard');
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
      role="Clinic setup"
      variant="register"
      title="Register your clinic."
      intro="Tell us how your clinic works. You can refine doctors, services and queue settings after approval."
      asideTitle="Start with the clinic patients already know."
      asideBody="Add the practical details once. Intezo turns them into a clear patient booking experience and a live operational queue."
      asideItems={[
        'Add services and opening hours',
        'Verify the clinic email address',
        'Continue after administrator approval'
      ]}
    >
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label>Clinic name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="The name patients will see"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email address *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Clinic email"
            />
          </div>
          <div className="form-group">
            <label>Phone number *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="Clinic phone number"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Address *</label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            rows="3"
            placeholder="Full clinic address"
          />
        </div>

        <div className="form-group">
          <label>Services offered *</label>
          <div className="services-checkbox-group">
            {serviceOptions.map((service) => (
              <label key={service} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.services.includes(service)}
                  onChange={() => handleServiceChange(service)}
                />
                <span className="checkmark" />
                {service}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group operating-hours">
          <label>Operating hours *</label>
          <div className="time-inputs">
            <div className="time-input">
              <label>Opening time</label>
              <input
                type="time"
                value={formData.operatingHours.opening}
                onChange={(e) => handleTimeChange('opening', e.target.value)}
                required
              />
            </div>
            <div className="time-input">
              <label>Closing time</label>
              <input
                type="time"
                value={formData.operatingHours.closing}
                onChange={(e) => handleTimeChange('closing', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="At least 6 characters"
              minLength="6"
            />
          </div>
          <div className="form-group">
            <label>Confirm password *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Repeat your password"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? 'Creating clinic…' : 'Register clinic'}
        </button>
      </form>

      <div className="auth-switch">
        <p>Already registered?</p>
        <Link to="/clinic/login">Sign in to your clinic</Link>
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

export default Register;
