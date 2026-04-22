// Dashboard.js - Updated for doctor-specific queues
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getDoctors, 
  getDoctorQueue, 
  callNextPatient, 
  toggleClinicStatus, 
  getClinicStatus, 
  getPublicDoctorQueue
} from '../api/clinicApi';
import { useSocket } from '../context/PusherContext';
import CurrentQueue from '../components/Dashboard/CurrentQueue';
import UpcomingPatients from '../components/Dashboard/UpcomingPatients';
import QueueStats from '../components/Dashboard/QueueStats';
import SkippedPatients from '../components/Dashboard/SkippedPatients';
import '../styles/Dashboard.scss';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // State for doctors list and selected doctor
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  
  // Queue data state
  const [queueData, setQueueData] = useState({
    current: 0,
    upcoming: [],
    totalWaiting: 0,
    avgWaitTime: 0,
    canCallNext: true,
    completedToday: 0,
    peakWaitTime: 0
  });
  
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [itemsPerPage] = useState(8);

  const [clinicStatus, setClinicStatus] = useState({
    isOpen: false,
    operatingHours: { opening: '09:00', closing: '17:00' },
    lastStatusChange: null,
    isWithinOperatingHours: true
  });
  const [statusLoading, setStatusLoading] = useState(false);

  // Load doctors list
  const fetchDoctors = async () => {
    try {
      const response = await getDoctors();
      const doctorsList = Array.isArray(response.data) ? response.data : [];
      setDoctors(doctorsList);
      
      // Auto-select first available doctor or first doctor
      if (doctorsList.length > 0) {
        const availableDoctor = doctorsList.find(d => d.isAvailable) || doctorsList[0];
        setSelectedDoctor(availableDoctor);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setError('Failed to load doctors list');
    }
  };

  // Fetch clinic status
  const fetchClinicStatus = async () => {
    try {
      const response = await getClinicStatus();
      setClinicStatus(response.data);
    } catch (err) {
      console.error('Error fetching clinic status:', err);
    }
  };

  // Fetch queue data for selected doctor
  const fetchQueueData = async (isRefresh = false) => {
    if (!selectedDoctor) return;
    
    if (isRefresh) setRefreshing(true);

    try {
      // Add cache-busting parameter when refreshing
      const timestamp = isRefresh ? Date.now() : undefined;
      const response = await getPublicDoctorQueue(currentUser.clinic._id, selectedDoctor._id, timestamp);
      const data = response.data;
      
      setQueueData({
        current: data.current || 0,
        upcoming: data.upcoming || [],
        totalWaiting: data.totalWaiting || 0,
        avgWaitTime: data.avgWaitTime || 0,
        canCallNext: data.canCallNext !== undefined ? data.canCallNext : (data.upcoming?.length > 0),
        completedToday: data.completedToday || 0,
        peakWaitTime: data.peakWaitTime || 0
      });
      setLastUpdated(new Date());
      setUpcomingPage(1);
      setError('');
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.response?.data?.error || 'Failed to load queue data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Toggle clinic status
  const handleToggleStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await toggleClinicStatus();
      setClinicStatus(prev => ({
        ...prev,
        isOpen: response.data.isOpen,
        lastStatusChange: new Date()
      }));
      // Refresh queue data after status change
      fetchQueueData(true);
    } catch (err) {
      console.error('Error toggling clinic status:', err);
      alert(err.response?.data?.error || 'Failed to update clinic status');
    } finally {
      setStatusLoading(false);
    }
  };

  // Call next patient for selected doctor
  const handleNextPatient = async () => {
    if (!queueData.canCallNext || !selectedDoctor) return;

    try {
      const response = await callNextPatient(selectedDoctor._id);
      
      // Immediately update UI
      const newCurrent = response.data.currentNumber;
      setQueueData(prev => ({
        ...prev,
        current: newCurrent,
        upcoming: prev.upcoming.filter(p => p.number !== newCurrent),
        totalWaiting: prev.totalWaiting - 1,
        completedToday: prev.completedToday + 1,
        canCallNext: response.data.hasNextPatient
      }));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update queue');
      fetchQueueData();
    }
  };

  const handleSkipPatient = async (patientNumber) => {
    try {
      const token = localStorage.getItem('clinicToken') || localStorage.getItem('token');
      const response = await fetch('/api/queue/skip', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doctorId: selectedDoctor._id,
          patientNumber: patientNumber
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      fetchQueueData();
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to skip patient');
    }
  };

  const handleCallBackPatient = () => {
    fetchQueueData();
  };

  const handleRefresh = () => {
    fetchQueueData(true);
  };

  const handlePageChange = (newPage) => {
    setUpcomingPage(newPage);
  };

  const handleDoctorChange = (doctor) => {
    setSelectedDoctor(doctor);
  };

  // Memoized paginated upcoming patients
  const paginatedUpcoming = useMemo(() => {
    const startIndex = (upcomingPage - 1) * itemsPerPage;
    return queueData.upcoming.slice(startIndex, startIndex + itemsPerPage);
  }, [queueData.upcoming, upcomingPage, itemsPerPage]);

  // Initial data loading
  useEffect(() => {
    if (currentUser?.clinic?._id) {
      fetchDoctors();
      fetchClinicStatus();
    }
  }, [currentUser]);

  // Load queue data when selected doctor changes
  useEffect(() => {
    if (selectedDoctor) {
      setError('');
      setLoading(true);
      fetchQueueData();
    }
  }, [selectedDoctor]);

  // Add effect to handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedDoctor) {
        fetchQueueData(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedDoctor]);

  // Clinic status check interval
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClinicStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Socket.IO subscription for real-time updates
  useEffect(() => {
    if (!socket || !selectedDoctor) return;

    console.log('🔌 Setting up socket for doctor:', selectedDoctor._id);
    
    // Clear previous listeners
    socket.off('queue_updated');
    
    // Join rooms
    socket.emit('join_clinic', currentUser.clinic._id);
    socket.emit('join_doctor', selectedDoctor._id);
    
    // Listen for updates
    const handleQueueUpdate = (data) => {
      console.log('📢 Queue update received:', data);
      
      // Always update if data matches current doctor
      if (data.doctorId === selectedDoctor._id) {
        console.log('✅ Updating queue data for doctor:', selectedDoctor._id);
        setQueueData(prev => ({
          current: data.currentNumber !== undefined ? data.currentNumber : prev.current,
          upcoming: data.upcoming || prev.upcoming,
          totalWaiting: data.totalWaiting !== undefined ? data.totalWaiting : prev.totalWaiting,
          avgWaitTime: data.avgWaitTime !== undefined ? data.avgWaitTime : prev.avgWaitTime,
          canCallNext: data.hasNextPatient !== undefined ? data.hasNextPatient : prev.canCallNext,
          completedToday: prev.completedToday,
          peakWaitTime: prev.peakWaitTime
        }));
        setLastUpdated(new Date());
      }
    };
    
    socket.on('queue_updated', handleQueueUpdate);

    return () => {
      socket.off('queue_updated', handleQueueUpdate);
    };
  }, [socket, selectedDoctor, currentUser?.clinic?._id]);

  if (loading) return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div className="header-left">
            <div>
              <h1>Queue Dashboard</h1>
              <div className="clinic-info">
                <span className="clinic-name">{currentUser?.clinic?.name}</span>
                <span className="separator">•</span>
                <span className="user-role">{currentUser?.role}</span>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="clinic-status">
              <div className="status-toggle">
                <span className="status-label">
                  {clinicStatus.isOpen ? 'Open' : 'Closed'}
                </span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={clinicStatus.isOpen}
                    onChange={handleToggleStatus}
                    disabled={statusLoading || !clinicStatus.isWithinOperatingHours}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
              {!clinicStatus.isWithinOperatingHours && clinicStatus.isOpen && (
                <div className="status-warning">
                  Outside operating hours - clinic will auto-close
                </div>
              )}
            </div>
            
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

        {/* Doctor Selection */}
        {doctors.length > 0 && (
          <div className="doctor-selection">
            <h3>Select Doctor</h3>
            <div className="doctor-buttons">
              {doctors.map(doctor => (
                <button
                  key={doctor._id}
                  className={`doctor-btn ${selectedDoctor?._id === doctor._id ? 'active' : ''} ${
                    !doctor.isAvailable ? 'unavailable' : ''
                  }`}
                  onClick={() => handleDoctorChange(doctor)}
                  disabled={!doctor.isActive}
                >
                  <span className="doctor-name">{doctor.name}</span>
                  <span className="doctor-status">
                    {doctor.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="alert error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {selectedDoctor && (
          <>
            <div className="selected-doctor-info">
              <h2>Dr. {selectedDoctor.name}</h2>
              <p className="doctor-specialty">{selectedDoctor.specialty}</p>
              <div className={`availability-status ${selectedDoctor.isAvailable ? 'available' : 'unavailable'}`}>
                {selectedDoctor.isAvailable ? 'Available' : 'Currently Unavailable'}
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="top-row">
                <div className="current-queue-container">
                  <CurrentQueue
                    currentNumber={queueData.current}
                    onNext={handleNextPatient}
                    onSkip={handleSkipPatient}
                    canCallNext={queueData.canCallNext && selectedDoctor.isAvailable}
                    totalWaiting={queueData.totalWaiting}
                    nextPatientNumber={queueData.upcoming.length > 0 ? queueData.upcoming[0]?.number : null}
                    doctorName={selectedDoctor.name}
                  />
                </div>

                <div className="queue-stats-container">
                  <QueueStats
                    totalPatients={queueData.totalWaiting}
                    avgWaitTime={queueData.avgWaitTime}
                    upcomingCount={queueData.upcoming.length}
                    currentNumber={queueData.current}
                    completedToday={queueData.completedToday}
                    doctor={selectedDoctor}
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
                  doctor={selectedDoctor}
                />
                
                <SkippedPatients
                  doctorId={selectedDoctor._id}
                  onCallBack={handleCallBackPatient}
                />
              </div>
            </div>
          </>
        )}

        {!selectedDoctor && doctors.length === 0 && (
          <div className="no-doctors">
            <h3>No doctors available</h3>
            <p>Please add doctors to your clinic to start managing queues.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;