// src/components/Dashboard/DoctorDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getDoctorQueueStatus as getClinicDoctorQueueStatus, updateCurrentNumber } from '../../api/clinicApi';
import { getDoctorQueueStatus as getDoctorQueueStatusFromDoctorApi } from '../../api/doctorApi';
import { useSocket } from '../../context/PusherContext';
import { useDoctorAuth } from '../../context/DoctorAuthContext';
import { useAuth } from '../../context/AuthContext';
import { API_CONFIG } from '../../config/api';
import CurrentQueue from './CurrentQueue';
import UpcomingPatients from './UpcomingPatients';
import QueueStats from './QueueStats';
import SkippedPatients from './SkippedPatients';
import './DoctorDashboard.scss';

const DoctorDashboard = () => {
  const { doctorId, clinicId } = useParams();
  const { currentDoctor } = useDoctorAuth();
  const { currentUser } = useAuth();
  const { socket, joinDoctor, subscribe } = useSocket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  const [clinicData, setClinicData] = useState(null);

  const authenticatedDoctor = currentDoctor?.doctor ||
    (currentDoctor?._id || currentDoctor?.id ? currentDoctor : null);
  const currentDoctorId = doctorId || authenticatedDoctor?._id || authenticatedDoctor?.id;
  const selectedClinicId = clinicId || currentUser?.clinic?.id || currentUser?.clinic?._id;

  // The route is authoritative when stale clinic and doctor sessions both exist.
  const isDoctorContext = Boolean(clinicId || (!doctorId && authenticatedDoctor));
  const isClinicContext = !isDoctorContext && !!currentUser;

  // Get appropriate token and API endpoints
  const getToken = () => {
    if (isDoctorContext) {
      try {
        const session = JSON.parse(localStorage.getItem('doctorUser') || '{}');
        return session.token || localStorage.getItem('doctorToken');
      } catch {
        return localStorage.getItem('doctorToken');
      }
    }
    if (isClinicContext) {
      return currentUser?.token || localStorage.getItem('clinicToken') || localStorage.getItem('token');
    }
    return localStorage.getItem('token');
  };

  const getApiEndpoint = (endpoint) => {
    if (isDoctorContext) return `${API_CONFIG.baseUrl}/doctors/queue/${endpoint}`;
    return `${API_CONFIG.baseUrl}/queues/${endpoint}`;
  };
  const [queueData, setQueueData] = useState({
    currentNumber: 0,
    currentQueueId: null,
    upcoming: [],
    totalWaiting: 0,
    avgWaitTime: 15,
    canCallNext: true,
    completedToday: 0
  });
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [skipRefresh, setSkipRefresh] = useState(0);

  const fetchDoctorQueueData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      setLoading(true);
      
      if (!currentDoctorId) {
        throw new Error('Your doctor session is incomplete. Please sign out and sign in again.');
      }
      
      const timestamp = isRefresh ? Date.now() : undefined;
      
      // Use appropriate API based on context
      const response = isDoctorContext 
        ? await getDoctorQueueStatusFromDoctorApi(currentDoctorId, timestamp, selectedClinicId)
        : await getClinicDoctorQueueStatus(currentDoctorId, timestamp, selectedClinicId);
      
      setDoctorData(response.data.doctor);
      
      if (selectedClinicId && authenticatedDoctor?.clinics) {
        const clinic = authenticatedDoctor.clinics.find((association) => {
          const associatedClinic = association.clinic;
          const associatedClinicId = typeof associatedClinic === 'object'
            ? associatedClinic.id || associatedClinic._id
            : associatedClinic;
          return String(associatedClinicId) === String(selectedClinicId);
        });
        setClinicData(clinic || (response.data.clinic ? { clinic: response.data.clinic } : null));
      } else if (response.data.clinic) {
        setClinicData({ clinic: response.data.clinic });
      }
      
      setQueueData({
        currentNumber: response.data.currentNumber || 0,
        currentQueueId: response.data.currentQueueId || null,
        upcoming: response.data.upcoming || [],
        totalWaiting: response.data.totalWaiting || 0,
        avgWaitTime: 15,
        canCallNext: (response.data.upcoming?.length || 0) > 0,
        completedToday: response.data.completedToday || 0
      });
      setLastUpdated(new Date());
      setUpcomingPage(1);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load doctor queue data');
      console.error('Error fetching doctor queue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authenticatedDoctor?.clinics, currentDoctorId, isDoctorContext, selectedClinicId]);

  useEffect(() => {
    if (currentDoctorId) {
      // Clear previous data when switching doctors
      setQueueData({
        currentNumber: 0,
        upcoming: [],
        totalWaiting: 0,
        avgWaitTime: 15,
        canCallNext: true,
        completedToday: 0
      });
      setDoctorData(null);
      setClinicData(null);
      setError('');
      
      fetchDoctorQueueData();
    } else {
      setLoading(false);
      setError('Your doctor session is incomplete. Please sign out and sign in again.');
    }
  }, [currentDoctorId, selectedClinicId, fetchDoctorQueueData]);

  // Add effect to handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentDoctorId) {
        fetchDoctorQueueData(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentDoctorId, fetchDoctorQueueData]);

  // Memoized paginated upcoming patients
  const paginatedUpcoming = useMemo(() => {
    const startIndex = (upcomingPage - 1) * itemsPerPage;
    return queueData.upcoming.slice(startIndex, startIndex + itemsPerPage);
  }, [queueData.upcoming, upcomingPage, itemsPerPage]);

  const handleRefresh = () => {
    fetchDoctorQueueData(true);
  };

  // Updated handleNextPatient function to work in both contexts
  const isLastPatient = queueData.totalWaiting === 1;

  const handleNextPatient = async () => {
    if (!queueData.canCallNext) return;

    try {
      if (isClinicContext) {
        // Use clinic API
        const response = await updateCurrentNumber({
          doctorId: currentDoctorId,
          clinicId: selectedClinicId,
          action: 'next'
        });
        
        setQueueData(prev => ({
          ...prev,
          currentNumber: response.data.currentNumber,
          completedToday: prev.completedToday + 1,
          upcoming: prev.upcoming.filter(p => p.number !== response.data.currentNumber),
          totalWaiting: Math.max(0, prev.totalWaiting - 1),
          canCallNext: response.data.hasNextPatient
        }));
      } else {
        // Use doctor API
        const response = await fetch(getApiEndpoint('next'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            doctorId: currentDoctorId,
            clinicId: selectedClinicId,
            action: 'next'
          })
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        setQueueData(prev => ({
          ...prev,
          currentNumber: data.currentNumber,
          completedToday: prev.completedToday + 1,
          upcoming: prev.upcoming.filter(p => p.number !== data.currentNumber),
          totalWaiting: Math.max(0, prev.totalWaiting - 1),
          canCallNext: data.hasNextPatient
        }));
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to update queue');
      fetchDoctorQueueData();
    }
  };

  const handleSkipPatient = async () => {
    try {
      const response = await fetch(getApiEndpoint('skip'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ doctorId: currentDoctorId, clinicId: selectedClinicId })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      setQueueData(prev => ({
        ...prev,
        currentNumber: data.currentNumber,
        upcoming: prev.upcoming.filter(p => p.number !== data.currentNumber),
        totalWaiting: Math.max(0, prev.totalWaiting - 1),
        canCallNext: data.hasNextPatient
      }));
      setLastUpdated(new Date());
      setError('');
      setSkipRefresh(prev => prev + 1);
    } catch (err) {
      setError(err.message || 'Failed to skip patient');
    }
  };

  // Handle call back skipped patient
  const handleCallBackPatient = (patientName, patientNumber) => {
    // Refresh queue data to show the patient back in the queue
    fetchDoctorQueueData();
  };

  const handlePageChange = (newPage) => {
    setUpcomingPage(newPage);
  };

  useEffect(() => {
    if (!socket || !currentDoctorId) return;

    joinDoctor(currentDoctorId);
    console.log('✅ Joined doctor room:', currentDoctorId);

    const unsubscribe = subscribe('queue_updated', (data) => {
      console.log('📢 Doctor queue update received:', data);
      if (data.doctorId === currentDoctorId) {
        setQueueData(prev => ({
          ...prev,
          currentNumber: data.currentNumber !== undefined ? data.currentNumber : prev.currentNumber,
          currentQueueId: data.currentQueueId !== undefined ? data.currentQueueId : prev.currentQueueId,
          upcoming: data.upcoming || prev.upcoming,
          totalWaiting: data.totalWaiting !== undefined ? data.totalWaiting : prev.totalWaiting,
          canCallNext: data.hasNextPatient !== undefined ? data.hasNextPatient : prev.canCallNext
        }));
        setLastUpdated(new Date());
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [socket, currentDoctorId, joinDoctor, subscribe]);

  if (loading) return (
    <div className="doctor-dashboard-container">
      <div className="dashboard-content">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading doctor queue data...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="doctor-dashboard-container">
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div className="header-left">
            <div>
              <h1>{clinicId ? 'Clinic Queue Management' : 'Doctor Dashboard'}</h1>
              <div className="doctor-info">
                <span className="doctor-name">{doctorData?.name || authenticatedDoctor?.name || 'Doctor'}</span>
                <span className="separator">•</span>
                <span className="doctor-specialty">{doctorData?.specialty || authenticatedDoctor?.specialties?.[0] || 'Specialty'}</span>
                {clinicId && clinicData && (
                  <>
                    <span className="separator">•</span>
                    <span className="clinic-name">{clinicData.clinic?.name}</span>
                  </>
                )}
                <span className="separator">•</span>
                <span className={`status ${doctorData?.isAvailable ? 'available' : 'unavailable'}`}>
                  {doctorData?.isAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="data-freshness">
              <span className="status-indicator live"></span>
              <span>Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--:--'}</span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="refresh-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 8V12M12 16H12.01M21 12C21 极 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C极 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="top-row">
            <div className="current-queue-container">
              <CurrentQueue
                currentNumber={queueData.currentNumber}
                currentQueueId={queueData.currentQueueId}
                onNext={handleNextPatient}
                onSkip={handleSkipPatient}
                canCallNext={queueData.canCallNext}
                totalWaiting={queueData.totalWaiting}
                nextPatientNumber={queueData.upcoming.length > 0 ? queueData.upcoming[0]?.number : null}
                isLastPatient={isLastPatient}
              />
            </div>

            <div className="queue-stats-container">
              <QueueStats
                totalPatients={queueData.totalWaiting}
                avgWaitTime={queueData.avgWaitTime}
                upcomingCount={queueData.upcoming.length}
                currentNumber={queueData.currentNumber}
                completedToday={queueData.completedToday}
              />
            </div>
          </div>

          <div className="bottom-row">
            <UpcomingPatients
              patients={paginatedUpcoming}
              totalPatients={queueData.upcoming.length}
              currentPage={upcomingPage}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
            
            <SkippedPatients
              doctorId={currentDoctorId}
              clinicId={selectedClinicId}
              refreshSignal={skipRefresh}
              onCallBack={handleCallBackPatient}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
