import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useDoctorAuth } from '../../context/DoctorAuthContext';

const DoctorPrivateRoute = () => {
  const { currentDoctor, loading } = useDoctorAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return currentDoctor ? <Outlet /> : <Navigate to="/doctor/login" replace />;
};

export default DoctorPrivateRoute;