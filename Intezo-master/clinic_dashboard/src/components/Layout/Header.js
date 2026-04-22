// Header.js - Fixed responsive version
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import './Header.scss';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // Close sidebar when clicking outside on desktop
  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.querySelector('.app-sidebar');
      const sidebarToggle = document.querySelector('.sidebar-toggle');
      
      if (isSidebarOpen && window.innerWidth >= 1024) {
        if (sidebar && !sidebar.contains(event.target) && 
            sidebarToggle && !sidebarToggle.contains(event.target)) {
          closeSidebar();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  return (
    <>
      <header className="app-header">
        <div className="container-fluid">
          <div className="header-content">
            {/* Sidebar Toggle Button - Always visible when user is logged in */}
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
                {/* Desktop Navigation */}
                <nav className="nav-menu desktop-menu">
                  <Link to="/clinic/dashboard" className="nav-link">Dashboard</Link>
                  <Link to="/settings" className="nav-link">Settings</Link>
                  <button onClick={logout} className="logout-btn">
                    Logout
                  </button>
                </nav>

                {/* Mobile Navigation - Only Logout */}
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

      {/* Sidebar Component */}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
    </>
  );
};

export default Header;