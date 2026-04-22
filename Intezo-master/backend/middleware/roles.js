import Clinic from '../models/Clinic.js';

// Middleware to authorize clinic admin
export const authorizeClinic = async (req, res, next) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic.id);
    
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    // Check if the user has the required role
    if (clinic.role !== 'clinic') {
      return res.status(403).json({ error: 'Clinic admin access required' });
    }

    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

// Middleware to authorize patient
export const authorizePatient = async (req, res, next) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Patient access required' });
    }
    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

// Middleware to authorize admin
export const authorizeAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

// Generic role requirement middleware
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Determine user role based on which property is set
      let userRole = req.user.role;
      if (!userRole) {
        if (req.patient) userRole = 'patient';
        else if (req.clinic) userRole = 'clinic';
        else if (req.doctor) userRole = 'doctor';
      }

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: `Access denied. Required roles: ${allowedRoles.join(', ')}` });
      }

      next();
    } catch (err) {
      console.error('Role authorization error:', err);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};