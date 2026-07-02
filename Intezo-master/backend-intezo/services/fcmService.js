import admin from 'firebase-admin';
import Patient from '../models/Patient.js';
import { Op } from 'sequelize';

class FCMService {
  constructor() {
    this.initialized = false;
    this.recentNotifications = new Map(); // Track recent notifications
    this.cleanupInterval = setInterval(() => this.cleanupOldNotifications(), 60000); // Cleanup every minute
  }
  
  initialize() {
    if (!this.initialized && !admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      this.initialized = true;
    }
  }

  async sendQueueNotification(patientId, currentNumber, patientNumber, clinicName, doctorName) {
    try {
      // Deduplication check
      const notificationKey = `queue_${patientId}_${currentNumber}_${patientNumber}`;
      if (this.isRecentNotification(notificationKey, 120000)) { // 2 minutes
        console.log(`Skipping duplicate queue notification for patient ${patientId}`);
        return;
      }
      
      this.initialize();
      const patient = await Patient.findByPk(patientId);
      if (!patient?.fcmToken) return;

      const message = {
        token: patient.fcmToken,
        notification: {
          title: 'Your Turn is Coming Soon!',
          body: `At ${clinicName} with Dr. ${doctorName}\nCurrently serving: ${currentNumber}\nYour number: ${patientNumber}\n${patientNumber - currentNumber} patients ahead of you`,
        },
        data: {
          type: 'queue_update',
          currentNumber: currentNumber.toString(),
          patientNumber: patientNumber.toString(),
          clinicName,
          doctorName,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'queue_channel',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: 'Your Turn is Coming Soon!',
                body: `At ${clinicName} with Dr. ${doctorName}\nCurrently serving: ${currentNumber}\nYour number: ${patientNumber}\n${patientNumber - currentNumber} patients ahead of you`,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      await admin.messaging().send(message);
      this.markNotificationSent(notificationKey);
    } catch (error) {
      console.error('Error sending queue notification:', error);
    }
  }

  async sendClinicOpenNotification(clinicId, clinicName) {
    try {
      this.initialize();

      const targetId = String(clinicId);
      // Only fetch patients who subscribed to this clinic and have a token.
      const patients = await Patient.findAll({
        where: {
          fcmToken: { [Op.ne]: null },
          clinicNotifications: { [Op.contains]: [clinicId] },
        },
        attributes: ['id', 'name', 'fcmToken', 'clinicNotifications'],
      });

      if (patients.length === 0) {
        console.log(`No patients with enabled notifications for clinic ${clinicName}`);
        return;
      }
      console.log(`Sending clinic open notification to ${patients.length} patient(s)`);

      const title = 'Clinic Now Open!';
      const body = `${clinicName} is now open for appointments\nTap to visit clinic`;
      const data = {
        type: 'clinic_open',
        clinicId: targetId,
        clinicName: String(clinicName),
      };

      // Send per-token with the same send() call used by the working
      // queue/served notifications (instead of sendEachForMulticast).
      let successCount = 0;
      let failureCount = 0;
      const notified = [];
      for (const patient of patients) {
        try {
          await admin.messaging().send({
            token: patient.fcmToken,
            notification: { title, body },
            data,
            android: {
              priority: 'high',
              notification: {
                channelId: 'clinic_channel',
                priority: 'high',
                defaultSound: true,
                defaultVibrateTimings: true,
              },
            },
            apns: {
              payload: {
                aps: { alert: { title, body }, sound: 'default', badge: 1 },
              },
            },
          });
          successCount++;
          notified.push(patient);
        } catch (err) {
          failureCount++;
          console.error(`Failed to send clinic open to patient ${patient.id}: ${err.message}`);
          if (err.code === 'messaging/registration-token-not-registered') {
            await patient.update({ fcmToken: null }).catch(() => {});
          }
        }
      }
      console.log(`Clinic open notification sent: ${successCount} successful, ${failureCount} failed`);

      // Auto-remove the subscription only for patients we actually notified.
      for (const patient of notified) {
        const clinicNotifications = (patient.clinicNotifications || []).filter(
          (id) => String(id) !== targetId
        );
        await patient.update({ clinicNotifications }).catch(() => {});
      }
    } catch (error) {
      console.error('Error sending clinic open notification:', error);
    }
  }

  async sendDoctorAvailableNotification(doctorId, doctorName, clinicName) {
    try {
      // Deduplication check
      const notificationKey = `doctor_available_${doctorId}`;
      if (this.isRecentNotification(notificationKey, 300000)) { // 5 minutes
        console.log(`Skipping duplicate doctor available notification for Dr. ${doctorName}`);
        return;
      }
    
      this.initialize();

      const targetId = String(doctorId);
      // Only fetch patients who subscribed to this doctor and have a token.
      const patients = await Patient.findAll({
        where: {
          fcmToken: { [Op.ne]: null },
          doctorNotifications: { [Op.contains]: [doctorId] },
        },
        attributes: ['id', 'name', 'fcmToken', 'doctorNotifications'],
      });

      if (patients.length === 0) {
        console.log(`No patients with enabled notifications for Dr. ${doctorName}`);
        return;
      }
      console.log(`Sending doctor available notification to ${patients.length} patient(s)`);

      const title = 'Doctor Now Available!';
      const body = `Dr. ${doctorName} is now available at ${clinicName}\nTap to view doctor details`;
      const data = {
        type: 'doctor_available',
        doctorId: targetId,
        doctorName: String(doctorName),
        clinicName: String(clinicName),
      };

      let successCount = 0;
      let failureCount = 0;
      const notified = [];
      for (const patient of patients) {
        try {
          await admin.messaging().send({
            token: patient.fcmToken,
            notification: { title, body },
            data,
            android: {
              priority: 'high',
              notification: {
                channelId: 'doctor_channel',
                priority: 'high',
                defaultSound: true,
                defaultVibrateTimings: true,
              },
            },
            apns: {
              payload: {
                aps: { alert: { title, body }, sound: 'default', badge: 1 },
              },
            },
          });
          successCount++;
          notified.push(patient);
        } catch (err) {
          failureCount++;
          console.error(`Failed to send doctor available to patient ${patient.id}: ${err.message}`);
          if (err.code === 'messaging/registration-token-not-registered') {
            await patient.update({ fcmToken: null }).catch(() => {});
          }
        }
      }
      console.log(`Doctor available notification sent: ${successCount} successful, ${failureCount} failed`);

      // Auto-remove the subscription only for patients we actually notified.
      for (const patient of notified) {
        const doctorNotifications = (patient.doctorNotifications || []).filter(
          (id) => String(id) !== targetId
        );
        await patient.update({ doctorNotifications }).catch(() => {});
      }

      this.markNotificationSent(notificationKey);
    } catch (error) {
      console.error('Error sending doctor available notification:', error);
    }
  }

  async getPatientNotificationPrefs(patientId) {
    try {
      const patient = await Patient.findByPk(patientId);
      return {
        clinics: patient?.clinicNotifications || [],
        doctors: patient?.doctorNotifications || []
      };
    } catch (error) {
      return { clinics: [], doctors: [] };
    }
  }

  async removeClinicNotification(patientId, clinicId) {
    try {
      const patient = await Patient.findByPk(patientId);
      let clinicNotifications = patient.clinicNotifications || [];
      clinicNotifications = clinicNotifications.filter(id => id !== clinicId);
      await patient.update({ clinicNotifications });
    } catch (error) {
      console.error('Error removing clinic notification:', error);
    }
  }

  async removeDoctorNotification(patientId, doctorId) {
    try {
      const patient = await Patient.findByPk(patientId);
      let doctorNotifications = patient.doctorNotifications || [];
      doctorNotifications = doctorNotifications.filter(id => id !== doctorId);
      await patient.update({ doctorNotifications });
    } catch (error) {
      console.error('Error removing doctor notification:', error);
    }
  }

  // Deduplication helper methods
  isRecentNotification(key, timeWindow = 300000) { // 5 minutes default
    const lastSent = this.recentNotifications.get(key);
    if (!lastSent) return false;
    return (Date.now() - lastSent) < timeWindow;
  }

  markNotificationSent(key) {
    this.recentNotifications.set(key, Date.now());
  }

  async sendPatientServedNotification(patientId, clinicName, doctorName, queueId = null) {
    try {
      // More specific deduplication key including queue ID and timestamp
      const notificationKey = `patient_served_${patientId}_${queueId || Date.now()}`;
      if (this.isRecentNotification(notificationKey, 300000)) { // 5 minutes
        console.log(`Skipping duplicate served notification for patient ${patientId}`);
        return;
      }
      
      // Additional check for recent patient served notifications (any queue)
      const generalKey = `patient_served_any_${patientId}`;
      if (this.isRecentNotification(generalKey, 60000)) { // 1 minute for any served notification
        console.log(`Skipping recent served notification for patient ${patientId}`);
        return;
      }
      
      this.initialize();
      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        console.log(`❌ Patient ${patientId} not found in database`);
        return;
      }
      
      if (!patient.fcmToken) {
        console.log(`❌ No FCM token found for patient ${patientId} (${patient.name || 'Unknown'} - ${patient.email || 'No email'})`);
        console.log(`💡 Patient needs to open the app to register FCM token for notifications`);
        return;
      }
      
      console.log(`📱 Sending thank you notification to patient ${patientId} (${patient.name || 'Unknown'}) with token: ${patient.fcmToken.substring(0, 20)}...`);

      const message = {
        token: patient.fcmToken,
        notification: {
          title: 'Thank You for Using Our Services!',
          body: `Your consultation with Dr. ${doctorName} at ${clinicName} is complete. We hope you had a great experience!`,
        },
        data: {
          type: 'patient_served',
          clinicName,
          doctorName,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'queue_channel',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: 'Thank You for Using Our Services!',
                body: `Your consultation with Dr. ${doctorName} at ${clinicName} is complete. We hope you had a great experience!`,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.markNotificationSent(notificationKey);
      this.markNotificationSent(generalKey); // Mark general key too
      console.log(`✅ Thank you notification sent successfully to patient ${patientId} (${patient.name || 'Unknown'}), FCM response: ${response}`);
    } catch (error) {
      console.error(`❌ Failed to send thank you notification to patient ${patientId}:`, error.message);
      if (error.code === 'messaging/registration-token-not-registered') {
        console.log(`🔄 Removing invalid FCM token for patient ${patientId}`);
        const patient = await Patient.findByPk(patientId);
        if (patient) await patient.update({ fcmToken: null });
      }
    }
  }

  async sendReportNotification(patientId, clinicName, doctorName, reportTitle) {
    try {
      this.initialize();
      const patient = await Patient.findByPk(patientId);
      if (!patient?.fcmToken) return;

      const message = {
        token: patient.fcmToken,
        notification: {
          title: 'Medical Report Ready!',
          body: `Your report "${reportTitle}" from Dr. ${doctorName} at ${clinicName} is now available`,
        },
        data: {
          type: 'report_ready',
          clinicName,
          doctorName,
          reportTitle,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'report_channel',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: 'Medical Report Ready!',
                body: `Your report "${reportTitle}" from Dr. ${doctorName} at ${clinicName} is now available`,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      await admin.messaging().send(message);
      console.log(`Report notification sent to patient ${patientId}`);
    } catch (error) {
      console.error('Error sending report notification:', error);
    }
  }

  cleanupOldNotifications() {
    const now = Date.now();
    const maxAge = 600000; // 10 minutes
    
    for (const [key, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > maxAge) {
        this.recentNotifications.delete(key);
      }
    }
  }
}

export default new FCMService();