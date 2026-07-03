import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_DOWNLOAD_FALLBACK_URL, resolveAppDownload } from '../utils/appDownload';
import '../styles/MainPage.scss';

const MainPage = () => {
  const [preparingDownload, setPreparingDownload] = useState(false);

  const downloadApp = async () => {
    if (preparingDownload) return;
    setPreparingDownload(true);
    try {
      const download = await resolveAppDownload();
      window.location.assign(download.url);
    } catch {
      window.location.assign(APP_DOWNLOAD_FALLBACK_URL);
    } finally {
      setPreparingDownload(false);
    }
  };
  return (
    <div className="main-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1>Intezo</h1>
          <p className="tagline">Smart Queue Management for Healthcare</p>
          <p className="description">
            Revolutionizing healthcare with intelligent queue management. 
            Reduce wait times, improve patient experience, and optimize clinic operations.
          </p>
          
          {/* Mobile App Download */}
          <div className="app-download-hero">
            <div className="app-download-content">
              <div className="app-icon">📱</div>
              <div className="app-details">
                <h3>Download Mobile App</h3>
                <p>Get the Intezo app for seamless queue management</p>
              </div>
              <div className="download-action">
                <button
                  onClick={downloadApp}
                  className={`download-btn${preparingDownload ? ' loading' : ''}`}
                  disabled={preparingDownload}
                >
                  {preparingDownload ? 'Preparing...' : 'Download Android App'}
                </button>
                <span className="download-help">Smaller device-specific APK when supported</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <h2>Why Choose Intezo?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <h3>Real-time Updates</h3>
            <p>Live queue status and estimated wait times</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Mobile Integration</h3>
            <p>Seamless experience across all devices</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analytics Dashboard</h3>
            <p>Insights to optimize your operations</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure & Reliable</h3>
            <p>HIPAA compliant and enterprise-grade security</p>
          </div>
        </div>
      </div>

      <div className="access-section">
        <h2>Choose Your Access</h2>
        <div className="access-options">
          <div className="access-card">
            <div className="access-icon">🏥</div>
            <h3>Clinic Management</h3>
            <p>Manage your clinic, staff, and patient queues</p>
            <div className="access-buttons">
              <Link to="/clinic/login" className="btn btn-primary">
                Clinic Login
              </Link>
              <Link to="/clinic/register" className="btn btn-secondary">
                Register Clinic
              </Link>
            </div>
          </div>

          <div className="access-card">
            <div className="access-icon">👨‍⚕️</div>
            <h3>Doctor Portal</h3>
            <p>Access your patient queues across multiple clinics</p>
            <div className="access-buttons">
              <Link to="/doctor/login" className="btn btn-primary">
                Doctor Login
              </Link>
              <Link to="/doctor/register" className="btn btn-secondary">
                Register as Doctor
              </Link>
            </div>
          </div>
          
          <div className="access-card admin-access">
            <div className="access-icon">⚙️</div>
            <h3>Admin Dashboard</h3>
            <p>System administration for developers and managers</p>
            <div className="access-buttons">
              <Link to="/admin/login" className="btn btn-admin">
                Admin Access
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-section">
        <p>&copy; 2024 Intezo. Transforming Healthcare Operations.</p>
      </div>
    </div>
  );
};

export default MainPage;
