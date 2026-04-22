import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerDoctor, loginDoctor, getDoctorProfile } from '../api/clinicApi';

const DoctorAuthContext = createContext();

export const useDoctorAuth = () => useContext(DoctorAuthContext);

export const DoctorAuthProvider = ({ children }) => {
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = async () => {
      const doctorData = localStorage.getItem('doctorUser');
      if (doctorData) {
        try {
          const doctor = JSON.parse(doctorData);
          setCurrentDoctor(doctor);
        } catch (error) {
          localStorage.removeItem('doctorUser');
        }
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const register = async (doctorData) => {
    try {
      const response = await registerDoctor(doctorData);
      const doctor = {
        token: response.data.token,
        doctor: response.data.doctor
      };
      localStorage.setItem('doctorUser', JSON.stringify(doctor));
      setCurrentDoctor(doctor);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const response = await loginDoctor(email, password);
      
      // If response has token, login is complete
      if (response.data.token) {
        const doctor = {
          token: response.data.token,
          doctor: response.data.doctor
        };
        localStorage.setItem('doctorUser', JSON.stringify(doctor));
        setCurrentDoctor(doctor);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('doctorUser');
    setCurrentDoctor(null);
    navigate('/');
  };

  const value = {
    currentDoctor,
    register,
    login,
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