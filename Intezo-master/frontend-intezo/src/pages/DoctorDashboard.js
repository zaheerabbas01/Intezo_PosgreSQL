import React, { useState, useEffect } from 'react';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { getDoctorStats, getDoctorProfile } from '../api/doctorApi';
import { useNavigate } from 'react-router-dom';
import ClinicDetailModal from '../components/Shared/ClinicDetailModal';
import '../styles/DoctorDashboard.scss';

const DoctorDashboard = () => {
  const { currentDoctor, logout } = useDoctorAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleManageClinic = (clinicId) => {
    navigate(`/doctor/clinic/${clinicId}`);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Add effect to refetch data when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchDashboardData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');
      
      // Add cache-busting parameter when force refreshing
      const timestamp = forceRefresh ? Date.now() : undefined;
      
      const [statsResponse, profileResponse] = await Promise.all([
        getDoctorStats(timestamp),
        getDoctorProfile(timestamp)
      ]);
      setStats(statsResponse.data);
      setDoctorProfile(profileResponse.data.doctor);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="doctor-dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="doctor-dashboard">
      <div className="dashboard-header">
        <div className="doctor-info">
          <h1>Welcome, Dr. {doctorProfile?.name || currentDoctor?.doctor?.name}</h1>
          <p className="specialty">{doctorProfile?.specialties?.join(', ') || currentDoctor?.doctor?.specialties?.join(', ')}</p>
          <div className="qualifications">
            <strong>Qualifications:</strong>
            {(doctorProfile?.qualifications || currentDoctor?.doctor?.qualifications)?.map((qual, index) => (
              <span key={index} className="qualification">{qual.degree} ({qual.year})</span>
            ))}
          </div>
          <p className="license">License: {doctorProfile?.licenseNumber || currentDoctor?.doctor?.licenseNumber}</p>
        </div>
        <div className="header-actions">
          <button onClick={() => fetchDashboardData(true)} className="refresh-btn">
            Refresh
          </button>
          <button onClick={() => window.location.href = '/doctor/settings'} className="settings-btn">
            Settings
          </button>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-content">
        <div className="stats-overview">
          <div className="stat-card">
            <div className="stat-icon">🏥</div>
            <div className="stat-info">
              <h3>{doctorProfile?.clinics?.length || currentDoctor?.doctor?.clinics?.length || 0}</h3>
              <p>Registered Clinics</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <h3>{stats?.totalPatientsServed || 0}</h3>
              <p>Total Patients Served</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <h3>{stats?.todayPatients || 0}</h3>
              <p>Patients Today</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-info">
              <h3>{stats?.activeQueues || 0}</h3>
              <p>Active Queues</p>
            </div>
          </div>
        </div>

        <div className="clinics-section">
          <h2>Your Clinics</h2>
          {(doctorProfile?.clinics || currentDoctor?.doctor?.clinics)?.length > 0 ? (
            <div className="clinics-grid">
              {(doctorProfile?.clinics || currentDoctor?.doctor?.clinics || []).map((clinicAssoc) => (
                <div 
                  key={typeof clinicAssoc.clinic === 'string' ? clinicAssoc.clinic : clinicAssoc.clinic?.id} 
                  className="clinic-card"
                  onClick={() => {
                    setSelectedClinic(clinicAssoc);
                    setIsModalOpen(true);
                  }}
                >
                  <div className="clinic-header">
                    <h3>{typeof clinicAssoc.clinic === 'string' ? clinicAssoc.clinic : (clinicAssoc.clinic?.name || 'Clinic')}</h3>
                    <span className={`status ${clinicAssoc.isActive ? 'active' : 'inactive'}`}>
                      {clinicAssoc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="clinic-summary">
                    <div className="summary-item">
                      <span className="label">Queue:</span>
                      <span className="value">#{clinicAssoc.currentQueueNumber || 0}</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Served:</span>
                      <span className="value">{clinicAssoc.patientsServed || 0}</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Fee:</span>
                      <span className="value">QAR {clinicAssoc.consultationFee || 0}</span>
                    </div>
                  </div>
                  
                  <div className="clinic-status">
                    <span className={`availability-badge ${clinicAssoc.isAvailable ? 'available' : 'unavailable'}`}>
                      {clinicAssoc.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                    <button 
                      className="manage-queue-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageClinic(typeof clinicAssoc.clinic === 'string' ? clinicAssoc.clinic : clinicAssoc.clinic.id);
                      }}
                    >
                      Manage Queue
                    </button>
                  </div>
                  
                  <div className="click-hint">Click for details</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-clinics">
              <div className="no-clinics-icon">🏥</div>
              <h3>No Clinics Registered</h3>
              <p>You haven't joined any clinics yet. Contact clinic administrators to get registered.</p>
            </div>
          )}
        </div>

        <div className="recent-activity">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {stats?.recentActivity?.length > 0 ? (
              stats.recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">📋</div>
                  <div className="activity-details">
                    <p>{activity.description}</p>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-activity">No recent activity</p>
            )}
          </div>
        </div>
      </div>
      
      <ClinicDetailModal 
        clinic={selectedClinic}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedClinic(null);
        }}
      />
    </div>
  );
};

export default DoctorDashboard;