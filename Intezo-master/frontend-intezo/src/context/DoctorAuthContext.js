import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerDoctor, loginDoctor } from '../api/clinicApi';

const DoctorAuthContext = createContext();

export const useDoctorAuth = () => useContext(DoctorAuthContext);

const normalizeDoctorSession = (storedSession) => {
  if (!storedSession || typeof storedSession !== 'object') return null;

  const doctor = storedSession.doctor ||
    (storedSession._id || storedSession.id ? storedSession : null);
  const token = storedSession.token || localStorage.getItem('doctorToken');

  if (!doctor || !token) return null;
  return { token, doctor };
};

export const DoctorAuthProvider = ({ children }) => {
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = async () => {
      const doctorData = localStorage.getItem('doctorUser');
      if (doctorData) {
        try {
          const doctor = normalizeDoctorSession(JSON.parse(doctorData));
          if (doctor) {
            // Migrate older sessions that stored the doctor and token separately.
            localStorage.setItem('doctorUser', JSON.stringify(doctor));
            localStorage.removeItem('doctorToken');
            setCurrentDoctor(doctor);
          } else {
            localStorage.removeItem('doctorUser');
            localStorage.removeItem('doctorToken');
          }
        } catch (error) {
          localStorage.removeItem('doctorUser');
          localStorage.removeItem('doctorToken');
        }
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const completeAuthentication = (token, doctor) => {
    if (!token || !doctor) {
      throw new Error('Incomplete doctor authentication response');
    }

    const session = { token, doctor };
    localStorage.setItem('doctorUser', JSON.stringify(session));
    localStorage.removeItem('doctorToken');
    setCurrentDoctor(session);
    return session;
  };

  const register = async (doctorData) => {
    try {
      const response = await registerDoctor(doctorData);
      if (response.data.token && response.data.doctor) {
        completeAuthentication(response.data.token, response.data.doctor);
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const response = await loginDoctor(email, password);
      
      // If response has token, login is complete
      if (response.data.token && response.data.doctor) {
        completeAuthentication(response.data.token, response.data.doctor);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('doctorUser');
    localStorage.removeItem('doctorToken');
    setCurrentDoctor(null);
    navigate('/');
  };

  const value = {
    currentDoctor,
    register,
    login,
    completeAuthentication,
    logout,
    loading
  };

  return (
    <DoctorAuthContext.Provider value={value}>
      {!loading && children}
    </DoctorAuthContext.Provider>
  );
};

export default DoctorAuthProvider;
