import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('clinicUser') || 'null');
    const token = user?.token || localStorage.getItem('token');

    if (!token) {
      console.warn('No authentication token found');
      return;
    }

    const backendUrl = 'https://api.intezo.online';
    console.log('🔗 CONNECTING TO:', backendUrl);
    
    const socketInstance = io(backendUrl, {
      auth: { token },
      query: { token }, // Fallback for auth
      transports: ['polling', 'websocket'], // Try polling first
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000,
      forceNew: true, // Force new connection to avoid stale data
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('✅ Socket.IO connected successfully');
      console.log('Socket ID:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
      console.error('Error details:', error);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('🔄❌ Socket.IO reconnection failed:', error.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const joinClinic = (clinicId) => {
    if (socket && isConnected) {
      socket.emit('join_clinic', clinicId);
    }
  };

  const joinDoctor = (doctorId) => {
    if (socket && isConnected) {
      socket.emit('join_doctor', doctorId);
    }
  };

  const subscribe = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinClinic, joinDoctor, subscribe }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
export default SocketProvider;