import User from './User.js';
import Clinic from './Clinic.js';
import Doctor from './Doctor.js';
import Patient from './Patient.js';
import Queue from './Queue.js';
import Report from './Report.js';
import PendingUser from './PendingUser.js';
import PremiumPayment from './PremiumPayment.js';
import PatientAuthChallenge from './PatientAuthChallenge.js';

// Queue associations
Queue.belongsTo(Clinic, { foreignKey: 'clinicId', as: 'clinic' });
Queue.belongsTo(Doctor, { foreignKey: 'doctorId', as: 'doctor' });
Queue.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

Clinic.hasMany(Queue, { foreignKey: 'clinicId' });
Doctor.hasMany(Queue, { foreignKey: 'doctorId' });
Patient.hasMany(Queue, { foreignKey: 'patientId' });

// Report associations
Report.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Report.belongsTo(Clinic, { foreignKey: 'clinicId', as: 'clinic' });
Report.belongsTo(Doctor, { foreignKey: 'doctorId', as: 'doctor' });

Patient.hasMany(Report, { foreignKey: 'patientId' });
Clinic.hasMany(Report, { foreignKey: 'clinicId' });
Doctor.hasMany(Report, { foreignKey: 'doctorId' });

// PremiumPayment associations
PremiumPayment.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
PremiumPayment.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });

Patient.hasMany(PremiumPayment, { foreignKey: 'patientId' });

export {
  User,
  Clinic,
  Doctor,
  Patient,
  Queue,
  Report,
  PendingUser,
  PremiumPayment,
  PatientAuthChallenge
};
