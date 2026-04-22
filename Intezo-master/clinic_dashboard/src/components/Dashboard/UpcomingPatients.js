// UpcomingPatients.js - Redesigned with solid appearance
import React, { useState, useMemo } from 'react';
import './UpcomingPatients.scss';

const UpcomingPatients = ({ 
  patients, 
  totalPatients, 
  currentPage, 
  itemsPerPage, 
  onPageChange 
}) => {
  const totalPages = Math.ceil(totalPatients / itemsPerPage);
  
  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageSelect = (e) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  return (
    <div className="upcoming-patients">
      <div className="header">
        <h2>Upcoming Patients</h2>
        <span className="badge">{totalPatients.toLocaleString()}</span>
      </div>
      
      <div className="pagination-controls">
        <button 
          onClick={handlePrevPage} 
          disabled={currentPage === 1}
          className="pagination-btn"
        >
          &larr; Prev
        </button>
        
        <div className="page-info">
          <span>Page </span>
          <select value={currentPage} onChange={handlePageSelect}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
          <span> of {totalPages}</span>
        </div>
        
        <button 
          onClick={handleNextPage} 
          disabled={currentPage === totalPages}
          className="pagination-btn"
        >
          Next &rarr;
        </button>
      </div>
      
      <div className="patients-list">
        {patients.length > 0 ? (
          patients.map(patient => (
            <div key={patient._id} className="patient-card">
              <div className="patient-number">#{patient.number}</div>
              <div className="patient-info">
                <h3>{patient.patient?.name || 'Anonymous'}</h3>
                {patient.patient?.phone && (
                  <div className="patient-meta">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M5 4H9L11 9L8.5 10.5C9.57096 12.6715 11.3285 14.429 13.5 15.5L15 13L20 15V19C20 20.1046 19.1046 21 18 21C14.0993 21 10.4204 19.8419 7.31371 17.6863C4.20701 15.5306 2 12.4009 2 9C2 7.89543 2.89543 7 4 7" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{patient.patient.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M9.172 14.828L12.001 12M14.83 9.172L12.001 12M12.001 12L9.172 9.172M12.001 12L14.83 14.828M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z" stroke="#a0aec0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>No upcoming patients</p>
          </div>
        )}
      </div>
      
      {patients.length > 0 && (
        <div className="pagination-footer">
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalPatients)} of {totalPatients.toLocaleString()} patients
        </div>
      )}
    </div>
  );
};

export default UpcomingPatients;