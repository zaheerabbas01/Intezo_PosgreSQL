import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import AdminRealTime from '../components/AdminRealTime';
import PremiumPayments from '../components/PremiumPayments';
import io from 'socket.io-client';
import { API_CONFIG } from '../config/api';
import '../styles/AdminDashboard.css';

const AdminDashboard = () => {
  const API_BASE = API_CONFIG.baseUrl;
  const [stats, setStats] = useState({});
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editForm, setEditForm] = useState({});
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    fetchStats();
    fetchPatients();
    fetchDoctors();
    fetchClinics();
    fetchPendingApprovals();
    fetchOnlineUsers();
    
    // Setup real-time connection
    const token = localStorage.getItem('adminToken');
    if (token) {
      const socket = io(`${API_BASE.replace('/api', '')}/admin`, {
        auth: { token },
        transports: ['websocket', 'polling']
      });
      
      socket.on('admin_update', (data) => {
        if (data.type === 'user_online' || data.type === 'user_offline') {
          fetchOnlineUsers();
        }
        if (data.type === 'registration_approved' || data.type === 'patient_deleted') {
          fetchStats();
          fetchPatients();
          fetchDoctors();
          fetchClinics();
          fetchPendingApprovals();
        }
      });
      
      return () => socket.disconnect();
    }
  }, []);

  const fetchOnlineUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/online-users`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setOnlineUsers(data.onlineUsers || []);
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  const isUserOnline = (userId) => {
    return onlineUsers.some(user => user.id === userId);
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/patients`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setPatients(data.patients);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/doctors`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setDoctors(data.doctors);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchClinics = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/clinics`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setClinics(data.clinics);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clinics:', error);
      setLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/pending-approvals`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setPendingApprovals(data.pendingUsers);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    }
  };

  const handleEdit = (type, item) => {
    setModalType(type);
    setEditForm({ ...item });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/${modalType}s/${editForm._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        setShowModal(false);
        setEditForm({});
        if (modalType === 'patient') fetchPatients();
        else if (modalType === 'doctor') fetchDoctors();
        else if (modalType === 'clinic') fetchClinics();
        fetchStats();
      }
    } catch (error) {
      console.error(`Error updating ${modalType}:`, error);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditForm({});
  };

  const handleRemoveClinic = async (doctorId, clinicId) => {
    if (!window.confirm('Remove doctor from this clinic?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/doctors/${doctorId}/clinics/${clinicId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      
      if (response.ok) {
        // Update the form to remove the clinic
        const updatedClinics = editForm.clinics.filter(c => c.clinic._id !== clinicId);
        setEditForm({...editForm, clinics: updatedClinics});
        fetchDoctors();
      }
    } catch (error) {
      console.error('Error removing clinic:', error);
    }
  };

  const handleRemoveDoctor = async (doctorId, clinicId) => {
    if (!window.confirm('Remove doctor from this clinic?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/doctors/${doctorId}/clinics/${clinicId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      
      if (response.ok) {
        // Update the form to remove the doctor
        const updatedDoctors = editForm.doctors.filter(d => d._id !== doctorId);
        setEditForm({...editForm, doctors: updatedDoctors});
        fetchClinics();
      }
    } catch (error) {
      console.error('Error removing doctor:', error);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/admin/approve/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      
      if (response.ok) {
        fetchPendingApprovals();
        fetchStats();
        fetchDoctors();
        fetchClinics();
      }
    } catch (error) {
      console.error('Error approving registration:', error);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this registration?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/reject/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      
      if (response.ok) {
        fetchPendingApprovals();
      }
    } catch (error) {
      console.error('Error rejecting registration:', error);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const response = await fetch(`${API_BASE}/admin/${type}s/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });

      if (response.ok) {
        if (type === 'patient') fetchPatients();
        else if (type === 'doctor') fetchDoctors();
        else if (type === 'clinic') fetchClinics();
        fetchStats();
      }
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
      
      <div className="admin-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'patients' ? 'active' : ''}
          onClick={() => setActiveTab('patients')}
        >
          Patients
        </button>
        <button 
          className={activeTab === 'doctors' ? 'active' : ''}
          onClick={() => setActiveTab('doctors')}
        >
          Doctors
        </button>
        <button 
          className={activeTab === 'clinics' ? 'active' : ''}
          onClick={() => setActiveTab('clinics')}
        >
          Clinics
        </button>
        <button 
          className={activeTab === 'approvals' ? 'active' : ''}
          onClick={() => setActiveTab('approvals')}
        >
          Pending Approvals ({pendingApprovals?.length || 0})
        </button>
        <button 
          className={activeTab === 'realtime' ? 'active' : ''}
          onClick={() => setActiveTab('realtime')}
        >
          Real-time Monitor
        </button>
        <button 
          className={activeTab === 'premium' ? 'active' : ''}
          onClick={() => setActiveTab('premium')}
        >
          Premium Payments
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Patients</h3>
            <p>{stats.totalPatients || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Total Doctors</h3>
            <p>{stats.totalDoctors || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Total Clinics</h3>
            <p>{stats.totalClinics || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Total Queues</h3>
            <p>{stats.totalQueues || 0}</p>
          </div>
        </div>
      )}

      {activeTab === 'realtime' && <AdminRealTime />}

      {activeTab === 'premium' && <PremiumPayments />}

      {activeTab === 'patients' && (
        <div className="data-table">
          <h2>Patients Management</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients?.map(patient => (
                <tr key={patient._id}>
                  <td>
                    {patient.name}
                    <span className={`status ${isUserOnline(patient._id) ? 'online' : 'offline'}`}>
                      {isUserOnline(patient._id) ? '🟢' : '🔴'}
                    </span>
                  </td>
                  <td>{patient.email}</td>
                  <td>{patient.phone}</td>
                  <td>
                    <button onClick={() => handleEdit('patient', patient)}>Edit</button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDelete('patient', patient._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )) || []}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'doctors' && (
        <div className="data-table">
          <h2>Doctors Management</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Specialization</th>
                <th>Clinics</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors?.map(doctor => (
                <tr key={doctor._id}>
                  <td>
                    {doctor.name}
                    <span className={`status ${isUserOnline(doctor._id) ? 'online' : 'offline'}`}>
                      {isUserOnline(doctor._id) ? '🟢' : '🔴'}
                    </span>
                  </td>
                  <td>{doctor.email}</td>
                  <td>{doctor.specialties?.join(', ')}</td>
                  <td>{doctor.clinics?.length || 0}</td>
                  <td>
                    <button onClick={() => handleEdit('doctor', doctor)}>Edit</button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDelete('doctor', doctor._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )) || []}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'clinics' && (
        <div className="data-table">
          <h2>Clinics Management</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clinics?.map(clinic => (
                <tr key={clinic._id}>
                  <td>
                    {clinic.name}
                    <span className={`status ${isUserOnline(clinic._id) ? 'online' : 'offline'}`}>
                      {isUserOnline(clinic._id) ? '🟢' : '🔴'}
                    </span>
                  </td>
                  <td>{clinic.address}</td>
                  <td>{clinic.phone}</td>
                  <td>
                    <button onClick={() => handleEdit('clinic', clinic)}>Edit</button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDelete('clinic', clinic._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )) || []}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="data-table">
          <h2>Pending Approvals</h2>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Email</th>
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingApprovals?.map(pending => (
                <tr key={pending._id}>
                  <td>{pending.userType}</td>
                  <td>{pending.userData.name}</td>
                  <td>{pending.userData.email}</td>
                  <td>
                    {pending.userType === 'doctor' && (
                      <div>
                        <strong>License:</strong> {pending.userData.licenseNumber}<br/>
                        <strong>Specialties:</strong> {pending.userData.specialties?.join(', ')}
                      </div>
                    )}
                    {pending.userType === 'clinic' && (
                      <div>
                        <strong>Address:</strong> {pending.userData.address}<br/>
                        <strong>Services:</strong> {pending.userData.services?.join(', ')}
                      </div>
                    )}
                  </td>
                  <td>
                    <button 
                      className="save-btn"
                      onClick={() => handleApprove(pending._id)}
                    >
                      Approve
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleReject(pending._id)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              )) || []}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Edit {modalType}</h2>
            
            {modalType === 'patient' && (
              <div className="form-group">
                <label>Name:</label>
                <input 
                  value={editForm.name || ''} 
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
                <label>Email:</label>
                <input 
                  value={editForm.email || ''} 
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                />
                <label>Phone:</label>
                <input 
                  value={editForm.phone || ''} 
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                />
                <label>Email Verified:</label>
                <select 
                  value={editForm.emailVerified || false} 
                  onChange={(e) => setEditForm({...editForm, emailVerified: e.target.value === 'true'})}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            )}

            {modalType === 'doctor' && (
              <div className="form-group">
                <label>Name:</label>
                <input 
                  value={editForm.name || ''} 
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
                <label>Email:</label>
                <input 
                  value={editForm.email || ''} 
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                />
                <label>Phone:</label>
                <input 
                  value={editForm.phone || ''} 
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                />
                <label>Specialties (comma separated):</label>
                <input 
                  value={editForm.specialties?.join(', ') || ''} 
                  onChange={(e) => setEditForm({...editForm, specialties: e.target.value.split(', ')})}
                />
                <label>License Number:</label>
                <input 
                  value={editForm.licenseNumber || ''} 
                  onChange={(e) => setEditForm({...editForm, licenseNumber: e.target.value})}
                />
                <label>Email Verified:</label>
                <select 
                  value={editForm.emailVerified || false} 
                  onChange={(e) => setEditForm({...editForm, emailVerified: e.target.value === 'true'})}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                
                <label>Associated Clinics:</label>
                <div className="clinic-list">
                  {editForm.clinics?.map((clinicAssoc, index) => (
                    <div key={index} className="clinic-item">
                      <span>{clinicAssoc.clinic?.name || 'Unknown Clinic'}</span>
                      <button 
                        type="button"
                        className="remove-clinic-btn"
                        onClick={() => handleRemoveClinic(editForm._id, clinicAssoc.clinic._id)}
                      >
                        Remove
                      </button>
                    </div>
                  )) || []}
                </div>
              </div>
            )}

            {modalType === 'clinic' && (
              <div className="form-group">
                <label>Name:</label>
                <input 
                  value={editForm.name || ''} 
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
                <label>Email:</label>
                <input 
                  value={editForm.email || ''} 
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                />
                <label>Phone:</label>
                <input 
                  value={editForm.phone || ''} 
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                />
                <label>Address:</label>
                <textarea 
                  value={editForm.address || ''} 
                  onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                />
                <label>Services (comma separated):</label>
                <input 
                  value={editForm.services?.join(', ') || ''} 
                  onChange={(e) => setEditForm({...editForm, services: e.target.value.split(', ')})}
                />
                <label>Email Verified:</label>
                <select 
                  value={editForm.emailVerified || false} 
                  onChange={(e) => setEditForm({...editForm, emailVerified: e.target.value === 'true'})}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                
                <label>Associated Doctors:</label>
                <div className="clinic-list">
                  {editForm.doctors?.map((doctor, index) => (
                    <div key={index} className="clinic-item">
                      <div>
                        <strong>{doctor.name}</strong>
                        <br />
                        <small>{doctor.email} - {doctor.specialties?.join(', ')}</small>
                      </div>
                      <button 
                        type="button"
                        className="remove-clinic-btn"
                        onClick={() => handleRemoveDoctor(doctor._id, editForm._id)}
                      >
                        Remove
                      </button>
                    </div>
                  )) || []}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="save-btn" onClick={handleSave}>Save Changes</button>
              <button className="cancel-btn" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;