import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { useNotification } from '../context/NotificationContext';
import { verifyDoctorEmail } from '../api/clinicApi';
import AuthShell from '../components/Auth/AuthShell';
import VerificationPopup from '../components/VerificationPopup';

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

  const handleVerification = async (doctorIdToVerify, code) => {
    try {
      setLoading(true);
      const response = await verifyDoctorEmail(doctorIdToVerify, code);

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
    <AuthShell
      role="Doctor registration"
      variant="register"
      title="Create your doctor profile."
      intro="Use the professional details clinics need to identify and assign you correctly."
      asideTitle="Your clinics and queues in one place."
      asideBody="Once approved and connected to a clinic, you can move between assignments without switching accounts."
      asideItems={[
        'Verify your professional details',
        'Join one or more clinic teams',
        'Work from a focused live queue'
      ]}
    >
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-row">
          <div className="form-group">
            <label>Full name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Your full professional name"
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
              placeholder="Your work email"
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
              placeholder="Your phone number"
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
                  <option value="">Select specialty</option>
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
                  <button
                    type="button"
                    onClick={() => {
                      const newSpecialties = formData.specialties.filter((_, itemIndex) => itemIndex !== index);
                      setFormData({ ...formData, specialties: newSpecialties });
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, specialties: [...formData.specialties, ''] });
              }}
            >
              Add specialty
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Qualifications</label>
          {formData.qualifications.map((qualification, index) => (
            <div key={index} className="qualification-input">
              <input
                type="text"
                placeholder="Degree"
                value={qualification.degree}
                onChange={(e) => {
                  const newQualifications = [...formData.qualifications];
                  newQualifications[index].degree = e.target.value;
                  setFormData({ ...formData, qualifications: newQualifications });
                }}
                required
              />
              <input
                type="text"
                placeholder="Institution"
                value={qualification.institution}
                onChange={(e) => {
                  const newQualifications = [...formData.qualifications];
                  newQualifications[index].institution = e.target.value;
                  setFormData({ ...formData, qualifications: newQualifications });
                }}
                required
              />
              <input
                type="number"
                placeholder="Year"
                value={qualification.year}
                onChange={(e) => {
                  const newQualifications = [...formData.qualifications];
                  newQualifications[index].year = e.target.value;
                  setFormData({ ...formData, qualifications: newQualifications });
                }}
                required
              />
              {formData.qualifications.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newQualifications = formData.qualifications.filter((_, itemIndex) => itemIndex !== index);
                    setFormData({ ...formData, qualifications: newQualifications });
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setFormData({
                ...formData,
                qualifications: [...formData.qualifications, { degree: '', institution: '', year: '' }]
              });
            }}
          >
            Add qualification
          </button>
        </div>

        <div className="form-group">
          <label>Medical license number</label>
          <input
            type="text"
            name="licenseNumber"
            value={formData.licenseNumber}
            onChange={handleChange}
            required
            placeholder="Your medical license number"
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
              placeholder="At least 6 characters"
              minLength="6"
            />
          </div>
          <div className="form-group">
            <label>Confirm password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Repeat your password"
              minLength="6"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? 'Creating profile…' : 'Register as a doctor'}
        </button>
      </form>

      <div className="auth-switch">
        <p>Already registered?</p>
        <Link to="/doctor/login">Sign in to the doctor portal</Link>
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

export default DoctorRegister;
