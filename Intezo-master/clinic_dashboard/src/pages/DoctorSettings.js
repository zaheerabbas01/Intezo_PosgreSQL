import React, { useState, useRef, useEffect } from 'react';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { updateDoctorProfile } from '../api/doctorApi';
import { API_CONFIG } from '../config/api';
import '../styles/DoctorSettings.scss';

const DoctorSettings = () => {
  const { currentDoctor, login } = useDoctorAuth();
  
  console.log('Current doctor from context:', currentDoctor);
  const [formData, setFormData] = useState({
    name: currentDoctor?.doctor?.name || '',
    phone: currentDoctor?.doctor?.phone || '',
    specialties: currentDoctor?.doctor?.specialties || [''],
    qualifications: currentDoctor?.doctor?.qualifications || [{ degree: '', institution: '', year: '' }]
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Set current profile photo if exists
    if (currentDoctor?.doctor?.profilePhoto) {
      const photoUrl = currentDoctor.doctor.profilePhoto.startsWith('https://') 
        ? currentDoctor.doctor.profilePhoto 
        : `${API_CONFIG.baseUrl.replace('/api', '')}${currentDoctor.doctor.profilePhoto}`;
      setPhotoPreview(photoUrl);
    }
  }, [currentDoctor]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      setProfilePhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handlePhotoUpload = async () => {
    if (!profilePhoto) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('profilePhoto', profilePhoto);
      
      const doctorUserStr = localStorage.getItem('doctorUser');
      if (!doctorUserStr) {
        throw new Error('No doctor user found in localStorage');
      }
      
      const doctorUser = JSON.parse(doctorUserStr);
      const token = doctorUser?.token;
      
      console.log('Doctor token:', token ? 'exists' : 'missing');
      console.log('Doctor user:', doctorUser);
      console.log('Full token:', token);
      console.log('Token length:', token?.length);
      console.log('Token starts with:', token?.substring(0, 20));
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`${API_CONFIG.baseUrl}/doctors/upload-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload photo');
      }
      
      const data = await response.json();
      setMessage('Profile photo uploaded successfully!');
      setError('');
      setProfilePhoto(null);
      setTimeout(() => setMessage(''), 3000);
      
      // Update photo preview with new URL
      const photoUrl = data.profilePhoto.startsWith('https://') 
        ? data.profilePhoto 
        : `${API_CONFIG.baseUrl.replace('/api', '')}${data.profilePhoto}`;
      setPhotoPreview(photoUrl);
    } catch (err) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoDelete = async () => {
    try {
      const doctorUserStr = localStorage.getItem('doctorUser');
      if (!doctorUserStr) {
        throw new Error('No doctor user found in localStorage');
      }
      
      const doctorUser = JSON.parse(doctorUserStr);
      const token = doctorUser?.token;
      
      const response = await fetch(`${API_CONFIG.baseUrl}/doctors/delete-photo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }
      
      setPhotoPreview(null);
      setProfilePhoto(null);
      setMessage('Profile photo deleted successfully!');
      setError('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete photo');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      const response = await updateDoctorProfile(formData);
      
      // Update local storage
      const updatedDoctor = {
        ...currentDoctor,
        doctor: response.data.doctor
      };
      localStorage.setItem('doctorUser', JSON.stringify(updatedDoctor));
      
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctor-settings">
      <div className="settings-header">
        <h1>Profile Settings</h1>
        <p>Update your professional information</p>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="profile-photo-section">
        <h2>Profile Photo</h2>
        <div className="photo-upload-container">
          <div className="photo-preview">
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" className="profile-image" />
            ) : (
              <div className="no-photo">
                <span>No photo uploaded</span>
              </div>
            )}
          </div>
          
          <div className="photo-actions">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="select-photo-button"
            >
              Select Photo
            </button>
            
            {profilePhoto && (
              <button
                type="button"
                onClick={handlePhotoUpload}
                disabled={uploading}
                className="upload-button"
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </button>
            )}
            
            {photoPreview && !profilePhoto && (
              <button
                type="button"
                onClick={handlePhotoDelete}
                className="delete-photo-button"
              >
                Delete Photo
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
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

        <div className="form-group">
          <label>Qualifications</label>
          {formData.qualifications.map((qual, index) => (
            <div key={index} className="qualification-input">
              <input
                type="text"
                placeholder="Degree"
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

        <button type="submit" disabled={loading} className="save-btn">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default DoctorSettings;