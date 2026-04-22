import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Layout/Sidebar';
import '../styles/Staff.scss';

const Staff = () => {
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Simulate fetching staff data
    const fetchStaff = async () => {
      try {
        // Replace with actual API call
        setTimeout(() => {
          setStaffMembers([
            { id: 1, name: 'Dr. Sarah Johnson', role: 'Doctor', email: 'sarah@clinic.com' },
            { id: 2, name: 'Nurse Emily Chen', role: 'Nurse', email: 'emily@clinic.com' },
            { id: 3, name: 'Receptionist Mike Brown', role: 'Receptionist', email: 'mike@clinic.com' }
          ]);
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error fetching staff:', error);
        setLoading(false);
      }
    };

    fetchStaff();
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return (
      <div className="staff-container">
        <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <div className="staff-content">
          <div className="loading">Loading staff members...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-container">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="staff-content">
        <div className="staff-header">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            ☰
          </button>
          <h1>Staff Management</h1>
          <button className="add-staff-btn">Add Staff Member</button>
        </div>

        <div className="staff-grid">
          <div className="staff-card">
            <h2>Clinic Staff</h2>
            <div className="staff-list">
              {staffMembers.map(staff => (
                <div key={staff.id} className="staff-item">
                  <div className="staff-info">
                    <h3>{staff.name}</h3>
                    <p>Role: {staff.role}</p>
                    <p>Email: {staff.email}</p>
                  </div>
                  <div className="staff-actions">
                    <button className="btn-primary">Edit</button>
                    <button className="btn-danger">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Staff;