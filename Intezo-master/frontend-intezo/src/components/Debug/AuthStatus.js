import React, { useState, useEffect } from 'react';
import { getAuthToken, isAuthenticated, getUserRole, makeAuthenticatedRequest } from '../../utils/authUtils';

const AuthStatus = () => {
  const [authInfo, setAuthInfo] = useState({
    hasToken: false,
    isValid: false,
    role: null,
    tokenPreview: '',
    apiTest: null
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = getAuthToken();
    const hasToken = !!token;
    const isValid = isAuthenticated();
    const role = getUserRole();
    const tokenPreview = token ? `${token.substring(0, 20)}...` : 'No token';

    let apiTest = null;
    if (isValid) {
      try {
        await makeAuthenticatedRequest('/api/reports/test');
        apiTest = 'API connection successful';
      } catch (error) {
        apiTest = `API test failed: ${error.message}`;
      }
    }

    setAuthInfo({
      hasToken,
      isValid,
      role,
      tokenPreview,
      apiTest
    });
  };

  const testReportOptions = async () => {
    try {
      const data = await makeAuthenticatedRequest('/api/reports/options');
      alert(`Report options loaded successfully! Found ${Object.keys(data.options || {}).length} option categories.`);
    } catch (error) {
      alert(`Failed to load report options: ${error.message}`);
    }
  };

  const testCustomTemplates = async () => {
    try {
      const data = await makeAuthenticatedRequest('/api/reports/custom-templates');
      alert(`Custom templates loaded successfully! Found ${Object.keys(data.templates || {}).length} template categories.`);
    } catch (error) {
      alert(`Failed to load custom templates: ${error.message}`);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px', 
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>Auth Debug Info</h4>
      <p><strong>Has Token:</strong> {authInfo.hasToken ? '✅' : '❌'}</p>
      <p><strong>Is Valid:</strong> {authInfo.isValid ? '✅' : '❌'}</p>
      <p><strong>Role:</strong> {authInfo.role || 'Unknown'}</p>
      <p><strong>Token:</strong> {authInfo.tokenPreview}</p>
      <p><strong>API Test:</strong> {authInfo.apiTest || 'Not tested'}</p>
      
      <div style={{ marginTop: '10px' }}>
        <button onClick={checkAuthStatus} style={{ marginRight: '5px', fontSize: '10px' }}>
          Refresh
        </button>
        <button onClick={testReportOptions} style={{ marginRight: '5px', fontSize: '10px' }}>
          Test Options
        </button>
        <button onClick={testCustomTemplates} style={{ fontSize: '10px' }}>
          Test Templates
        </button>
      </div>
    </div>
  );
};

export default AuthStatus;