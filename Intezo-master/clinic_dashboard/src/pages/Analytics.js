import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Layout/Sidebar';
import '../styles/Analytics.scss';

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Simulate fetching analytics data
    const fetchAnalytics = async () => {
      try {
        // Replace with actual API call
        setTimeout(() => {
          setAnalyticsData({
            totalPatients: 125,
            avgWaitTime: 15,
            peakHours: '10:00 - 12:00',
            monthlyVisits: 45,
            completionRate: '92%'
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <div className="analytics-content">
          <div className="loading">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="analytics-content">
        <div className="analytics-header">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            ☰
          </button>
          <h1>Analytics & Reports</h1>
        </div>

        <div className="analytics-grid">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <h3>Total Patients</h3>
                <p className="stat-number">{analyticsData.totalPatients}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-content">
                <h3>Avg Wait Time</h3>
                <p className="stat-number">{analyticsData.avgWaitTime} min</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <h3>Peak Hours</h3>
                <p className="stat-number">{analyticsData.peakHours}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <h3>Monthly Visits</h3>
                <p className="stat-number">{analyticsData.monthlyVisits}</p>
              </div>
            </div>
          </div>

          <div className="charts-section">
            <div className="chart-card">
              <h2>Weekly Performance</h2>
              <div className="chart-placeholder">
                <p>Weekly performance chart will be displayed here</p>
              </div>
            </div>

            <div className="chart-card">
              <h2>Patient Flow</h2>
              <div className="chart-placeholder">
                <p>Patient flow chart will be displayed here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;