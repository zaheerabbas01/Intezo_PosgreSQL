import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import '../styles/AdminRealTime.css';

const AdminRealTime = () => {
  const [stats, setStats] = useState({});
  const [activities, setActivities] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    // Connect to admin namespace
    const adminSocket = io('http://localhost:3000/admin', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    adminSocket.on('connect', () => {
      setConnected(true);
      console.log('Admin real-time connected');
    });

    adminSocket.on('admin_update', (data) => {
      console.log('Admin update:', data);
      
      if (data.type === 'new_activity') {
        setActivities(prev => [data.data, ...prev.slice(0, 49)]);
      } else if (data.type === 'user_online') {
        setOnlineUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.data.userId);
          return [...filtered, data.data];
        });
      } else if (data.type === 'user_offline') {
        setOnlineUsers(prev => prev.filter(u => u.userId !== data.data.userId));
      }
    });

    adminSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(adminSocket);

    // Fetch initial data
    fetchStats();
    fetchActivities();
    fetchOnlineUsers();

    return () => {
      adminSocket.disconnect();
    };
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/activity', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/online-users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await response.json();
      setOnlineUsers(data.onlineUsers || []);
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  return (
    <div className="admin-realtime">
      <div className="status-bar">
        <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Live' : '🔴 Offline'}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Patients</h3>
          <div className="stat-value">{stats.totalPatients || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Active Queues</h3>
          <div className="stat-value">{stats.activeQueues || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Pending Approvals</h3>
          <div className="stat-value">{stats.pendingApprovals || 0}</div>
        </div>
      </div>

      <div className="online-users">
        <h3>Online Users ({onlineUsers.length})</h3>
        <div className="users-grid">
          {['patient', 'doctor', 'clinic'].map(role => {
            const users = onlineUsers.filter(u => u.role === role);
            return (
              <div key={role} className="user-group">
                <h4>{role}s ({users.length})</h4>
                {users.map(user => (
                  <div key={user.id} className="user-item">
                    <span className="user-name">{user.name}</span>
                    <span className="login-time">
                      {new Date(user.loginTime).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="activity-feed">
        <h3>Live Activity</h3>
        <div className="activities">
          {activities.map((activity, index) => (
            <div key={index} className="activity-item">
              <span className="time">
                {new Date(activity.timestamp).toLocaleTimeString()}
              </span>
              <span className="description">{activity.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminRealTime;