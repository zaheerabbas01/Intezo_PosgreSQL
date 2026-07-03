import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateClinicProfile, getClinicProfile, updateClinicLocation } from '../api/clinicApi';
import { API_CONFIG } from '../config/api';
import ClinicLocationPicker from '../components/ClinicLocationPicker';
import '../styles/Settings.scss';

const hasCoordinates = clinic => (
  clinic?.latitude !== null &&
  clinic?.latitude !== undefined &&
  clinic?.longitude !== null &&
  clinic?.longitude !== undefined &&
  Number.isFinite(Number(clinic?.latitude)) &&
  Number.isFinite(Number(clinic?.longitude))
);

const Settings = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    opening: '09:00',
    closing: '17:00'
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationSuccess, setLocationSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const clinic = currentUser?.clinic;
  const locationIsSet = hasCoordinates(clinic);
  const initialLocation = locationIsSet
    ? { latitude: clinic.latitude, longitude: clinic.longitude }
    : null;

  const handleLocationSave = async (selectedLocation) => {
    if (!selectedLocation) {
      setLocationError('Select your clinic location on the map first.');
      return;
    }

    setLocationSaving(true);
    setLocationError('');
    setLocationSuccess(false);
    try {
      const response = await updateClinicLocation(
        selectedLocation.latitude,
        selectedLocation.longitude
      );
      const updatedUser = {
        ...currentUser,
        clinic: { ...clinic, ...response.data.location }
      };
      localStorage.setItem('clinicUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setLocationSuccess(true);
      setTimeout(() => setLocationSuccess(false), 3000);
    } catch (err) {
      setLocationError(err.response?.data?.error || 'Unable to save clinic location.');
    } finally {
      setLocationSaving(false);
    }
  };

  useEffect(() => {
    if (currentUser?.clinic) {
      setFormData({
        name: currentUser.clinic.name || '',
        phone: currentUser.clinic.phone || '',
        address: currentUser.clinic.address || '',
        opening: currentUser.clinic.operatingHours?.opening || '09:00',
        closing: currentUser.clinic.operatingHours?.closing || '17:00'
      });
      
      // Set current profile photo if exists
      if (currentUser.clinic.profilePhoto) {
        setPhotoPreview(currentUser.clinic.profilePhoto);
      }
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
      
      const response = await fetch(`${API_CONFIG.baseUrl}/clinics/upload-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload photo');
      }
      
      const data = await response.json();
      setSuccess(true);
      setError('');
      setProfilePhoto(null);
      setTimeout(() => setSuccess(false), 3000);
      
      // Update photo preview with new URL
      setPhotoPreview(data.profilePhoto);
    } catch (err) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoDelete = async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/clinics/delete-photo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }
      
      setPhotoPreview(null);
      setProfilePhoto(null);
      setSuccess(true);
      setError('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete photo');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateClinicProfile({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        operatingHours: {
          opening: formData.opening,
          closing: formData.closing
        }
      });
      const profileResponse = await getClinicProfile();
      const updatedUser = { ...currentUser, clinic: profileResponse.data };
      localStorage.setItem('clinicUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setSuccess(true);
      setError('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  return (
    <div className="settings-container">
      <h1>Clinic Settings</h1>
      
      {success && (
        <div className="success-message">
          Settings updated successfully!
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

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

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Clinic Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            rows="3"
          />
        </div>

        <div className="time-inputs">
          <div className="form-group">
            <label>Opening Time</label>
            <input
              type="time"
              name="opening"
              value={formData.opening}
              onChange={handleChange}
              required
            />
            <small className="time-hint">
              {formData.opening ? new Date(`1970-01-01T${formData.opening}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
            </small>
          </div>

          <div className="form-group">
            <label>Closing Time</label>
            <input
              type="time"
              name="closing"
              value={formData.closing}
              onChange={handleChange}
              required
            />
            <small className="time-hint">
              {formData.closing ? new Date(`1970-01-01T${formData.closing}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
            </small>
          </div>
        </div>

        <button type="submit" className="save-button">
          Save Changes
        </button>
      </form>

      <div className="location-section">
        <h2>Clinic Location</h2>
        <p className="location-hint">
          {locationIsSet
            ? 'Your clinic location is set. Move the marker or pick a new spot to update it.'
            : 'Set your clinic on the map so patients can find it nearby.'}
        </p>

        <div className={`location-status ${locationIsSet ? 'is-set' : 'not-set'}`}>
          {locationIsSet
            ? `Current location: ${Number(clinic.latitude).toFixed(6)}, ${Number(clinic.longitude).toFixed(6)}`
            : 'No location set yet'}
        </div>

        {locationSuccess && (
          <div className="success-message">Clinic location updated successfully!</div>
        )}

        <div className="location-map-wrapper">
          <ClinicLocationPicker
            initialLocation={initialLocation}
            onSave={handleLocationSave}
            saving={locationSaving}
            error={locationError}
            saveLabel={locationIsSet ? 'Update location' : 'Save clinic location'}
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;
