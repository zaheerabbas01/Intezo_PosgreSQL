import React, { useState, useEffect } from 'react';
import { useDoctorAuth } from '../../context/DoctorAuthContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/PusherContext';
import { API_CONFIG } from '../../config/api';
import './SkippedPatients.scss';

const SkippedPatients = ({ doctorId, onCallBack, refreshSignal = 0 }) => {
  const { currentDoctor } = useDoctorAuth();
  const { currentUser } = useAuth();
  const { socket, joinClinic, joinDoctor, subscribe } = useSocket();
  const [skippedPatients, setSkippedPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine context and get appropriate token/endpoint
  const isClinicContext = !!currentUser;
  const isDoctorContext = !!currentDoctor;

  const getToken = () => {
    if (isDoctorContext) return localStorage.getItem('doctorUser') ? JSON.parse(localStorage.getItem('doctorUser')).token : null;
    if (isClinicContext) return localStorage.getItem('token');
    return localStorage.getItem('token');
  };

  const API_BASE = API_CONFIG.baseUrl;

  const getApiEndpoint = (endpoint) => {
    if (isDoctorContext) return `${API_BASE}/doctors/queue/${endpoint}`;
    return `${API_BASE}/queues/${endpoint}`;
  };

  const fetchSkippedPatients = React.useCallback(async () => {
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
      setSkippedPatients(Array.isArray(data) ? data : (data.skippedPatients || []));
    } catch (err) {
      setError(err.message);
      console.error('Error fetching skipped patients:', err);
    } finally {
      setLoading(false);
    }
  }, [doctorId, isClinicContext, isDoctorContext, API_BASE]);

  useEffect(() => {
    if (doctorId) {
      fetchSkippedPatients();
    }
  }, [doctorId, refreshSignal, fetchSkippedPatients]);

  useEffect(() => {
    if (!doctorId || !socket) return;

    if (currentUser?.clinic?.id) {
      joinClinic(currentUser.clinic.id);
    }
    joinDoctor(doctorId);

    const handleQueueUpdate = (data) => {
      if (data.doctorId === doctorId) {
        fetchSkippedPatients();
      }
    };

    const unsubscribe = subscribe('queue_updated', handleQueueUpdate);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [doctorId, socket, currentUser?.clinic?.id, joinClinic, joinDoctor, subscribe, fetchSkippedPatients]);

  const handleServePatient = async (queueId, patientName, patientNumber) => {
    try {
      const response = await fetch(getApiEndpoint(`serve-skipped/${queueId}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      setSkippedPatients(prev => prev.filter(p => p.id !== queueId));
      if (onCallBack) onCallBack(patientName, patientNumber);
    } catch (err) {
      setError(err.message);
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
            <div key={patient.id} className="patient-card">
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
                onClick={() => handleServePatient(patient.id, patient.name, patient.number)}
                className="call-back-btn"
                title={`Serve ${patient.name}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12L11 14L15 10M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Serve Patient
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
