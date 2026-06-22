// QueueStats.js - Updated with additional stats
import React from 'react';
import './QueueStats.scss';

const QueueStats = ({ totalPatients, avgWaitTime, upcomingCount, currentNumber, completedToday }) => {
  const lastPatientWaitTime = totalPatients * avgWaitTime;
  const estimatedCompletionTime = new Date();
  estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + lastPatientWaitTime);

  const StatItem = ({ label, value, subtext, isHighlight, icon }) => (
    <div className={`stat-item ${isHighlight ? 'highlight' : ''}`}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {value}
          {subtext && <div className="subtext">{subtext}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="queue-stats">
      <div className="header">
        <h2>Queue Analytics</h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      
      <div className="stats-grid">
        <StatItem 
          label="Current Serving" 
          value={currentNumber || '--'} 
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        />
        <StatItem 
          label="Patients Waiting" 
          value={totalPatients.toLocaleString()} 
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        />
        <StatItem 
          label="Avg. Wait Time" 
          value={`${avgWaitTime} mins`} 
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        />
        <StatItem 
          label="Completed Today" 
          value={completedToday.toLocaleString()} 
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          isHighlight
        />
      </div>
    </div>
  );
};

export default QueueStats;