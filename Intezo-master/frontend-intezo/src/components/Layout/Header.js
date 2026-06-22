// Header.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import './Header.scss';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  // Sync main-content margin and body scroll lock
  useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (isSidebarOpen) {
      if (mainContent) mainContent.style.marginLeft = '260px';
      if (window.innerWidth < 1024) document.body.style.overflow = 'hidden';
    } else {
      if (mainContent) mainContent.style.marginLeft = '0';
      document.body.style.overflow = '';
    }
    return () => {
      if (mainContent) mainContent.style.marginLeft = '';
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  // Close sidebar on mobile when resizing to desktop, open on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="container-fluid">
          <div className="header-content">
            {currentUser && (
              <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            <Link to="/" className="logo">
              <span className="hospital-icon">🏥</span>
              <span className="logo-text">Clinic Queue</span>
            </Link>

            {currentUser && (
              <>
                <nav className="nav-menu desktop-menu">
                  <Link to="/clinic/dashboard" className="nav-link">Dashboard</Link>
                  <Link to="/clinic/settings" className="nav-link">Settings</Link>
                  <button onClick={logout} className="logout-btn">Logout</button>
                </nav>

                <nav className="mobile-menu">
                  <button onClick={logout} className="logout-btn mobile-logout">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </nav>
              </>
            )}
          </div>
        </div>
      </header>

      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
    </>
  );
};

export default Header;