import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

const AdminPrivateRoute = () => {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return admin ? <Outlet /> : <Navigate to="/admin/login" />;
};

export default AdminPrivateRoute;