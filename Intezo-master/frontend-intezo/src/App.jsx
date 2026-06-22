import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import SocketProvider from './context/PusherContext';
import PrivateRoute from './components/Auth/PrivateRoute';
import Header from './components/Layout/Header';
import MainPage from './pages/MainPage';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorLogin from './pages/DoctorLogin';
import DoctorRegister from './pages/DoctorRegister';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorSettings from './pages/DoctorSettings';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Staff from './pages/Staff';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Doctors from './pages/Doctors';
import DoctorDashboardComponent from './components/Dashboard/DoctorDashboard';
import DoctorAuthProvider from './context/DoctorAuthContext';
import DoctorPrivateRoute from './components/Auth/DoctorPrivateRoute';
import AdminAuthProvider from './context/AdminAuthContext';
import AdminPrivateRoute from './components/Auth/AdminPrivateRoute';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import { NotificationProvider } from './context/NotificationContext';

function App() {
  return (
    <Router>
      <NotificationProvider>
        <AuthProvider>
          <DoctorAuthProvider>
            <AdminAuthProvider>
              <SocketProvider>
            <Routes>
              {/* Main landing page */}
              <Route path="/" element={<MainPage />} />
              
              {/* Clinic routes */}
              <Route path="/clinic/login" element={<Login />} />
              <Route path="/clinic/register" element={<Register />} />
              
              {/* Doctor routes */}
              <Route path="/doctor/login" element={<DoctorLogin />} />
              <Route path="/doctor/register" element={<DoctorRegister />} />
              <Route element={<DoctorPrivateRoute />}>
                <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                <Route path="/doctor/settings" element={<DoctorSettings />} />
                <Route path="/doctor/clinic/:clinicId" element={<DoctorDashboardComponent />} />
              </Route>
              
              {/* Clinic dashboard routes */}
              <Route element={<PrivateRoute />}>
                <Route path="/clinic/dashboard" element={
                  <div className="app-root">
                    <div className="main-content">
                      <Header />
                      <Dashboard />
                    </div>
                  </div>
                } />
                <Route path="/clinic/patients" element={
                  <div className="app-root">
                    <div className="main-content">
                      <Header />
                      <Patients />
                    </div>
                  </div>
                } />
                <Route path="/clinic/staff" element={
                  <div className="app-root">
                    <div className="main-content">
                      <Header />
                      <Staff />
                    </div>
                  </div>
                } />
                <Route path="/clinic/analytics" element={
                  <div className="app-root">
                    <div className="main-content">
                      <Header />
                      <Analytics />
                    </div>
                  </div>
                } />
                <Route path="/clinic/settings" element={
                  <div className="app-root">
                    <div className="main-content">
                      <Header />
                      <Settings />
                    </div>
                  </div>
                } />
                <Route path="/clinic/doctors" element={
                  <div className="app-root">
                    <div className="main-content">
                      <Header />
                      <Doctors />
                    </div>
                  </div>
                } />
                <Route path="/clinic/doctor-dashboard/:doctorId" element={
                  <div className="app-root">
                    <div className="main-content">
                      <Header />
                      <DoctorDashboardComponent />
                    </div>
                  </div>
                } />
              </Route>
              
              {/* Legacy routes for backward compatibility */}
              <Route path="/login" element={<Navigate to="/clinic/login" replace />} />
              <Route path="/register" element={<Navigate to="/clinic/register" replace />} />
              <Route path="/dashboard" element={<Navigate to="/clinic/dashboard" replace />} />
              <Route path="/patients" element={<Navigate to="/clinic/patients" replace />} />
              <Route path="/staff" element={<Navigate to="/clinic/staff" replace />} />
              <Route path="/analytics" element={<Navigate to="/clinic/analytics" replace />} />
              <Route path="/settings" element={<Navigate to="/clinic/settings" replace />} />
              <Route path="/doctors" element={<Navigate to="/clinic/doctors" replace />} />
              
              
              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route element={<AdminPrivateRoute />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
              </Route>
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
              </SocketProvider>
            </AdminAuthProvider>
          </DoctorAuthProvider>
        </AuthProvider>
      </NotificationProvider>
    </Router>
  );
}

export default App;