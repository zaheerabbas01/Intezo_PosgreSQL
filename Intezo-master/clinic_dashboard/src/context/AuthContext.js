import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginClinic, getClinicProfile } from '../api/clinicApi';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);


export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = async () => {
      const userData = localStorage.getItem('clinicUser');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          await getClinicProfile();
          setCurrentUser(user);
        } catch (error) {
          localStorage.removeItem('clinicUser');
        }
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await loginClinic(email, password);
      
      // Check if verification is required
      if (response.data.requiresVerification) {
        // Don't set user yet, just return the response for verification flow
        return response;
      }
      
      // If login is successful (has token), set user
      if (response.data.token) {
        const user = {
          token: response.data.token,
          clinic: response.data.clinic
        };
        localStorage.setItem('clinicUser', JSON.stringify(user));
        localStorage.setItem('token', response.data.token);
        setCurrentUser(user);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const setUserAfterVerification = (userData) => {
    setCurrentUser(userData);
  };

  const logout = async () => {
    try {
      // Call backend logout API
      const { API_CONFIG } = await import('../config/api');
      await fetch(`${API_CONFIG.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentUser?.token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.log('Logout API call failed, continuing with local logout');
    }
    
    localStorage.removeItem('clinicUser');
    localStorage.removeItem('token');
    setCurrentUser(null);
    navigate('/login');
  };

  const value = {
    currentUser,
    login,
    logout,
    setUserAfterVerification,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;