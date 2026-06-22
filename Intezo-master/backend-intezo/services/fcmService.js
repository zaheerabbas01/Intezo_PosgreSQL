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
      // Deduplication check
      const notificationKey = `clinic_open_${clinicId}`;
      // if (this.isRecentNotification(notificationKey, 300000)) { // 5 minutes
      //   console.log(`Skipping duplicate clinic open notification for ${clinicName}`);
      //   return;
      // }
      
      this.initialize();
      // Only get patients who have enabled notifications for this clinic
      const patients = await Patient.findAll({ 
        where: {
          fcmToken: { [Op.ne]: null },
          clinicNotifications: { [Op.contains]: [clinicId] }
        }
      });
      
      if (patients.length === 0) {
        console.log(`No patients with enabled notifications for clinic ${clinicName}`);
        return;
      }
      
      const tokens = patients.map(p => p.fcmToken).filter(Boolean);
      console.log(`Sending clinic open notification to ${tokens.length} patients with enabled notifications`);

      const message = {
        tokens,
        notification: {
          title: 'Clinic Now Open!',
          body: `${clinicName} is now open for appointments\nTap to visit clinic`,
        },
        data: {
          type: 'clinic_open',
          clinicId: clinicId.toString(),
          clinicName: clinicName.toString(),
        },
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
            aps: {
              alert: {
                title: 'Clinic Now Open!',
                body: `${clinicName} is now open for appointments\nTap to visit clinic`,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Clinic open notification sent: ${response.successCount} successful, ${response.failureCount} failed`);
      
      // Auto-remove clinic notification preference for all patients who received the notification
      const patientIds = patients.map(p => p.id);
      for (const patient of patients) {
        let clinicNotifications = patient.clinicNotifications || [];
        clinicNotifications = clinicNotifications.filter(id => id !== clinicId);
        await patient.update({ clinicNotifications });
      }
      console.log(`Removed clinic notification preference for ${patients.length} patients`);
      
      // Mark as sent
      this.markNotificationSent(notificationKey);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            console.error(`Failed to send to token ${tokens[index]}: ${resp.error?.message}`);
          }
        });
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
      // Only get patients who have enabled notifications for this doctor
      const patients = await Patient.findAll({ 
        where: {
          fcmToken: { [Op.ne]: null },
          doctorNotifications: { [Op.contains]: [doctorId] }
        }
      });

      if (patients.length === 0) {
        console.log(`No patients with enabled notifications for Dr. ${doctorName}`);
        return;
      }

      const tokens = patients.map(p => p.fcmToken).filter(Boolean);
      console.log(`Sending doctor available notification to ${tokens.length} patients with enabled notifications`);

      const message = {
        tokens,
        notification: {
          title: 'Doctor Now Available!',
          body: `Dr. ${doctorName} is now available at ${clinicName}\nTap to view doctor details`,
        },
        data: {
          type: 'doctor_available',
          doctorId: doctorId.toString(),
          doctorName: doctorName.toString(),
          clinicName: clinicName.toString(),
        },
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
            aps: {
              alert: {
                title: 'Doctor Now Available!',
                body: `Dr. ${doctorName} is now available at ${clinicName}\nTap to view doctor details`,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Doctor available notification sent: ${response.successCount} successful, ${response.failureCount} failed`);
      
      // Auto-remove doctor notification preference for all patients who received the notification
      for (const patient of patients) {
        let doctorNotifications = patient.doctorNotifications || [];
        doctorNotifications = doctorNotifications.filter(id => id !== doctorId);
        await patient.update({ doctorNotifications });
      }
      console.log(`Removed doctor notification preference for ${patients.length} patients`);
      
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