import mongoose from 'mongoose';
import { connectDB } from './config/database.js';
import { User, Clinic, Doctor, Patient, Queue, Report, PendingUser, PremiumPayment } from './models/index.js';
import 'dotenv/config';

// MongoDB models (old)
const mongoUserSchema = new mongoose.Schema({}, { strict: false });
const mongoClinicSchema = new mongoose.Schema({}, { strict: false });
const mongoDoctorSchema = new mongoose.Schema({}, { strict: false });
const mongoPatientSchema = new mongoose.Schema({}, { strict: false });
const mongoQueueSchema = new mongoose.Schema({}, { strict: false });
const mongoReportSchema = new mongoose.Schema({}, { strict: false });
const mongoPendingUserSchema = new mongoose.Schema({}, { strict: false });
const mongoPremiumPaymentSchema = new mongoose.Schema({}, { strict: false });

const MongoUser = mongoose.model('User', mongoUserSchema);
const MongoClinic = mongoose.model('Clinic', mongoClinicSchema);
const MongoDoctor = mongoose.model('Doctor', mongoDoctorSchema);
const MongoPatient = mongoose.model('Patient', mongoPatientSchema);
const MongoQueue = mongoose.model('Queue', mongoQueueSchema);
const MongoReport = mongoose.model('Report', mongoReportSchema);
const MongoPendingUser = mongoose.model('PendingUser', mongoPendingUserSchema);
const MongoPremiumPayment = mongoose.model('PremiumPayment', mongoPremiumPaymentSchema);

const idMap = {
  users: {},
  clinics: {},
  doctors: {},
  patients: {},
  queues: {}
};

async function migrateData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/queue');
    console.log('MongoDB connected');

    console.log('Connecting to PostgreSQL...');
    await connectDB();
    console.log('PostgreSQL connected');

    // Migrate Users
    console.log('Migrating Users...');
    const mongoUsers = await MongoUser.find({});
    for (const user of mongoUsers) {
      const newUser = await User.create({
        name: user.name,
        email: user.email,
        role: user.role,
        verificationCode: user.verificationCode,
        verificationCodeExpires: user.verificationCodeExpires,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
      idMap.users[user._id.toString()] = newUser.id;
    }
    console.log(`Migrated ${mongoUsers.length} users`);

    // Migrate Clinics
    console.log('Migrating Clinics...');
    const mongoClinics = await MongoClinic.find({});
    for (const clinic of mongoClinics) {
      const newClinic = await Clinic.create({
        name: clinic.name,
        email: clinic.email,
        password: clinic.password,
        phone: clinic.phone,
        address: clinic.address,
        profilePhoto: clinic.profilePhoto,
        services: clinic.services,
        operatingHours: clinic.operatingHours,
        averageProcessTime: clinic.averageProcessTime,
        maxActiveQueues: clinic.maxActiveQueues,
        role: clinic.role,
        isOpen: clinic.isOpen,
        lastStatusChange: clinic.lastStatusChange,
        emailVerified: clinic.emailVerified,
        verificationCode: clinic.verificationCode,
        verificationCodeExpires: clinic.verificationCodeExpires,
        customReportTemplates: clinic.customReportTemplates,
        createdAt: clinic.createdAt,
        updatedAt: clinic.updatedAt
      }, { skipPasswordHash: true });
      idMap.clinics[clinic._id.toString()] = newClinic.id;
    }
    console.log(`Migrated ${mongoClinics.length} clinics`);

    // Migrate Doctors
    console.log('Migrating Doctors...');
    const mongoDoctors = await MongoDoctor.find({});
    for (const doctor of mongoDoctors) {
      const clinics = doctor.clinics?.map(c => ({
        ...c,
        clinic: idMap.clinics[c.clinic?.toString()] || c.clinic
      })) || [];

      const newDoctor = await Doctor.create({
        name: doctor.name,
        email: doctor.email,
        password: doctor.password,
        phone: doctor.phone,
        profilePhoto: doctor.profilePhoto,
        specialties: doctor.specialties,
        qualifications: doctor.qualifications,
        licenseNumber: doctor.licenseNumber,
        clinics: clinics,
        role: doctor.role,
        lastStatusChange: doctor.lastStatusChange,
        emailVerified: doctor.emailVerified,
        verificationCode: doctor.verificationCode,
        verificationCodeExpires: doctor.verificationCodeExpires,
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt
      }, { skipPasswordHash: true });
      idMap.doctors[doctor._id.toString()] = newDoctor.id;
    }
    console.log(`Migrated ${mongoDoctors.length} doctors`);

    // Migrate Patients
    console.log('Migrating Patients...');
    const mongoPatients = await MongoPatient.find({});
    for (const patient of mongoPatients) {
      const newPatient = await Patient.create({
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        emailVerified: patient.emailVerified,
        verificationCode: patient.verificationCode,
        verificationCodeExpires: patient.verificationCodeExpires,
        fcmToken: patient.fcmToken,
        isPremium: patient.isPremium,
        premiumExpiresAt: patient.premiumExpiresAt,
        createdAt: patient.createdAt || patient.createdAt,
        updatedAt: patient.updatedAt
      });
      idMap.patients[patient._id.toString()] = newPatient.id;
    }
    console.log(`Migrated ${mongoPatients.length} patients`);

    // Migrate Queues
    console.log('Migrating Queues...');
    const mongoQueues = await MongoQueue.find({});
    let migratedQueues = 0;
    let skippedQueues = 0;
    
    for (const queue of mongoQueues) {
      const clinicId = idMap.clinics[queue.clinic?.toString()];
      if (!clinicId) {
        skippedQueues++;
        continue;
      }
      
      const newQueue = await Queue.create({
        clinicId: clinicId,
        doctorId: idMap.doctors[queue.doctor?.toString()] || null,
        patientId: idMap.patients[queue.patient?.toString()] || null,
        patientName: queue.patientName,
        manualEntry: queue.manualEntry,
        number: queue.number,
        status: queue.status,
        bookedAt: queue.bookedAt,
        servedAt: queue.servedAt,
        missedAt: queue.missedAt,
        cancelledAt: queue.cancelledAt,
        skippedAt: queue.skippedAt,
        createdAt: queue.createdAt,
        updatedAt: queue.updatedAt
      });
      idMap.queues[queue._id.toString()] = newQueue.id;
      migratedQueues++;
    }
    console.log(`Migrated ${migratedQueues} queues (skipped ${skippedQueues} invalid)`);

    // Update Patient queue references
    console.log('Updating Patient queue references...');
    for (const patient of mongoPatients) {
      const currentQueue = patient.currentQueue ? idMap.queues[patient.currentQueue.toString()] : null;
      const activeQueues = patient.activeQueues?.map(q => idMap.queues[q.toString()]).filter(Boolean) || [];
      const queueHistory = patient.queueHistory?.map(q => idMap.queues[q.toString()]).filter(Boolean) || [];
      const clinicNotifications = patient.clinicNotifications?.map(c => idMap.clinics[c.toString()]).filter(Boolean) || [];
      const doctorNotifications = patient.doctorNotifications?.map(d => idMap.doctors[d.toString()]).filter(Boolean) || [];

      await Patient.update({
        currentQueue,
        activeQueues,
        queueHistory,
        clinicNotifications,
        doctorNotifications
      }, {
        where: { id: idMap.patients[patient._id.toString()] }
      });
    }
    console.log('Patient queue references updated');

    // Migrate Reports
    console.log('Migrating Reports...');
    const mongoReports = await MongoReport.find({});
    let migratedReports = 0;
    let skippedReports = 0;
    
    for (const report of mongoReports) {
      const patientId = idMap.patients[report.patient?.toString()];
      const clinicId = idMap.clinics[report.clinic?.toString()];
      const doctorId = idMap.doctors[report.doctor?.toString()];
      
      if (!patientId || !clinicId || !doctorId) {
        skippedReports++;
        continue;
      }
      
      await Report.create({
        patientId: patientId,
        clinicId: clinicId,
        doctorId: doctorId,
        reportType: report.reportType,
        title: report.title,
        diagnosis: report.diagnosis,
        symptoms: report.symptoms,
        treatment: report.treatment,
        medications: report.medications,
        notes: report.notes,
        recommendations: report.recommendations,
        labTests: report.labTests,
        followUpDate: report.followUpDate,
        pdfUrl: report.pdfUrl,
        isRead: report.isRead,
        visitDate: report.visitDate,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      });
      migratedReports++;
    }
    console.log(`Migrated ${migratedReports} reports (skipped ${skippedReports} invalid)`);

    // Migrate PendingUsers
    console.log('Migrating PendingUsers...');
    const mongoPendingUsers = await MongoPendingUser.find({});
    for (const pendingUser of mongoPendingUsers) {
      await PendingUser.create({
        userData: pendingUser.userData,
        userType: pendingUser.userType,
        verificationCode: pendingUser.verificationCode,
        verificationCodeExpires: pendingUser.verificationCodeExpires,
        status: pendingUser.status,
        createdAt: pendingUser.createdAt,
        updatedAt: pendingUser.updatedAt
      });
    }
    console.log(`Migrated ${mongoPendingUsers.length} pending users`);

    // Migrate PremiumPayments
    console.log('Migrating PremiumPayments...');
    const mongoPremiumPayments = await MongoPremiumPayment.find({});
    let migratedPayments = 0;
    let skippedPayments = 0;
    
    for (const payment of mongoPremiumPayments) {
      const patientId = idMap.patients[payment.patient?.toString()];
      if (!patientId) {
        skippedPayments++;
        continue;
      }
      
      await PremiumPayment.create({
        patientId: patientId,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount,
        paymentImage: payment.paymentImage,
        status: payment.status,
        submittedAt: payment.submittedAt,
        reviewedAt: payment.reviewedAt,
        reviewedBy: idMap.users[payment.reviewedBy?.toString()],
        rejectionReason: payment.rejectionReason,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      });
      migratedPayments++;
    }
    console.log(`Migrated ${migratedPayments} premium payments (skipped ${skippedPayments} invalid)`);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
