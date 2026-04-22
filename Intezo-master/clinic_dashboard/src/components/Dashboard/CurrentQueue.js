// CurrentQueue.js - Bootstrap responsive version
import React from 'react';
import './CurrentQueue.scss';

const CurrentQueue = ({ currentNumber, onNext, onSkip, canCallNext, totalWaiting, nextPatientNumber }) => {
  return (
    <div className="current-queue">
      <div className="queue-header">
        <div className="queue-info d-flex justify-content-between align-items-center">
          <h2>Now Serving</h2>
          <span className="waiting-count">{totalWaiting} waiting</span>
        </div>
        <div className="queue-number">{currentNumber || '--'}</div>
      </div>
      <div className="queue-actions">
        <button
          onClick={onNext}
          disabled={!canCallNext}
          className={`next-patient-btn ${!canCallNext ? 'disabled' : ''}`}
        >
          {canCallNext ? (
            <>
              <span>Call Next Patient</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          ) : (
            'Queue Complete'
          )}
        </button>
        {canCallNext && nextPatientNumber && (
          <button
            onClick={() => onSkip(nextPatientNumber)}
            className="skip-patient-btn"
            title={`Skip patient #${nextPatientNumber}`}
          >
            <span>Skip Patient #{nextPatientNumber}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 12L11 14L15 10M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default CurrentQueue;