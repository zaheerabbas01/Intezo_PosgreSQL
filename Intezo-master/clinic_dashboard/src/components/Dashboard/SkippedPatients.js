import React, { useState, useEffect } from 'react';
import { useDoctorAuth } from '../../context/DoctorAuthContext';
import { useAuth } from '../../context/AuthContext';
import './SkippedPatients.scss';

const SkippedPatients = ({ doctorId, onCallBack }) => {
  const { currentDoctor } = useDoctorAuth();
  const { currentUser } = useAuth();
  const [skippedPatients, setSkippedPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine context and get appropriate token/endpoint
  const isClinicContext = !!currentUser;
  const isDoctorContext = !!currentDoctor;

  const getToken = () => {
    if (isDoctorContext) return localStorage.getItem('doctorToken');
    if (isClinicContext) return localStorage.getItem('clinicToken') || localStorage.getItem('token');
    return localStorage.getItem('token');
  };

  const getApiEndpoint = (endpoint) => {
    if (isDoctorContext) return `/api/doctors/queue/${endpoint}`;
    return `/api/queue/${endpoint}`;
  };

  useEffect(() => {
    if (doctorId) {
      fetchSkippedPatients();
    }
  }, [doctorId]);

  const fetchSkippedPatients = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(getApiEndpoint(`skipped/${doctorId}`), {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      setSkippedPatients(data.skippedPatients || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching skipped patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCallBack = async (queueId, patientName, patientNumber) => {
    try {
      const response = await fetch(getApiEndpoint(`call-back/${queueId}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ doctorId })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      setSkippedPatients(prev => prev.filter(p => p._id !== queueId));
      
      if (onCallBack) {
        onCallBack(patientName, patientNumber);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error calling back patient:', err);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="skipped-patients">
        <div className="header">
          <h3>Skipped Patients</h3>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="skipped-patients">
      <div className="header">
        <h3>Skipped Patients</h3>
        <span className="count">{skippedPatients.length}</span>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={fetchSkippedPatients} className="retry-btn">
            Retry
          </button>
        </div>
      )}
      
      <div className="patients-list">
        {skippedPatients.length > 0 ? (
          skippedPatients.map(patient => (
            <div key={patient._id} className="patient-card">
              <div className="patient-info">
                <div className="patient-number">#{patient.number}</div>
                <div className="patient-details">
                  <h4>{patient.name}</h4>
                  {patient.phone && (
                    <span className="phone">{patient.phone}</span>
                  )}
                  <span className="skipped-time">
                    Skipped at {formatTime(patient.skippedAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleCallBack(patient._id, patient.name, patient.number)}
                className="call-back-btn"
                title={`Call back ${patient.name}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 5A2 2 0 015 3H8.28C8.64 3 8.97 3.2 9.14 3.53L10.93 7.11C11.11 7.46 11.07 7.89 10.83 8.2L9.09 10.26C10.08 12.18 11.82 13.92 13.74 14.91L15.8 13.17C16.11 12.93 16.54 12.89 16.89 13.07L20.47 14.86C20.8 15.03 21 15.36 21 15.72V19A2 2 0 0119 21H18C10.82 21 5 15.18 5 8V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Call Back
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M9 12L11 14L15 10M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z" stroke="#a0aec0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>No skipped patients</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkippedPatients;