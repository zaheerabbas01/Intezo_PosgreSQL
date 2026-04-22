import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toggleDoctorAvailability } from '../../api/doctorApi';
import './ClinicDetailModal.scss';

const ClinicDetailModal = ({ clinic, isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isAvailable, setIsAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  useEffect(() => {
    if (clinic?.isAvailable !== undefined) {
      setIsAvailable(clinic.isAvailable);
    }
  }, [clinic]);
  
  if (!isOpen || !clinic) return null;

  const handleManageClinic = () => {
    navigate(`/doctor/clinic/${clinic.clinic._id}`);
    onClose();
  };

  const handleToggleAvailability = async () => {
    try {
      setUpdating(true);
      
      const response = await toggleDoctorAvailability(
        clinic.clinic._id,
        !isAvailable
      );

      if (response.data.success) {
        setIsAvailable(response.data.isAvailable);
        clinic.isAvailable = response.data.isAvailable;
      }
    } catch (err) {
      console.error('Error updating availability:', err);
      alert('Failed to update availability: ' + (err.response?.data?.message || err.message));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{clinic.clinic?.name || 'Clinic Details'}</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          <div className="clinic-status-header">
            <span className={`status-badge ${clinic.isActive ? 'active' : 'inactive'}`}>
              {clinic.isActive ? 'Active' : 'Inactive'}
            </span>
            <div className="availability-control">
              <span className="availability-label">Available:</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={handleToggleAvailability}
                  disabled={updating}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          <div className="clinic-info-grid">
            <div className="info-section">
              <h3>Contact Information</h3>
              <div className="info-item">
                <strong>Address:</strong>
                <span>{clinic.clinic?.address || 'N/A'}</span>
              </div>
              <div className="info-item">
                <strong>Phone:</strong>
                <span>{clinic.clinic?.phone || 'N/A'}</span>
              </div>
              <div className="info-item">
                <strong>Email:</strong>
                <span>{clinic.clinic?.email || 'N/A'}</span>
              </div>
            </div>

            <div className="info-section">
              <h3>Statistics</h3>
              <div className="info-item">
                <strong>Patients Served:</strong>
                <span>{clinic.patientsServed || 0}</span>
              </div>
              <div className="info-item">
                <strong>Current Queue:</strong>
                <span>#{clinic.currentQueueNumber || 0}</span>
              </div>
              <div className="info-item">
                <strong>Consultation Fee:</strong>
                <span>QAR {clinic.consultationFee || 0}</span>
              </div>
            </div>

            <div className="info-section">
              <h3>Schedule</h3>
              <div className="info-item">
                <strong>Available Days:</strong>
                <div className="days-container">
                  {clinic.availableDays?.map(day => (
                    <span key={day} className="day-pill">{day}</span>
                  ))}
                </div>
              </div>
              <div className="info-item">
                <strong>Working Hours:</strong>
                <span>{clinic.availableHours?.start} - {clinic.availableHours?.end}</span>
              </div>
            </div>

            {clinic.clinic?.description && (
              <div className="info-section full-width">
                <h3>Description</h3>
                <p className="description">{clinic.clinic.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="manage-clinic-btn" onClick={handleManageClinic}>
            Manage Clinic Queue
          </button>
          <button className="settings-btn" onClick={() => window.location.href = '/doctor/settings'}>
            Clinic Settings
          </button>
          <button className="close-modal-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicDetailModal;