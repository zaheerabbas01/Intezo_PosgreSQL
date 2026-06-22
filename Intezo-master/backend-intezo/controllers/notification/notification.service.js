import User from '../../models/User.js';
import FCMService from '../../services/fcmService.js';
import sequelize from '../../config/database.js';

export const notifyNearbyPatients = async (clinicId, doctorId, currentNumber) => {
  const triggerThreshold = currentNumber + 5;
  const usersToNotify = await User.findAll({
    where: sequelize.literal(`"subscribedClinics" @> :clinicId::jsonb AND EXISTS (SELECT 1 FROM jsonb_array_elements(queues) AS q WHERE q->>'clinicId' = :clinicIdRaw AND (q->>'number')::int <= :threshold AND (q->>'number')::int > :current)`),
    replacements: { clinicId: JSON.stringify([clinicId]), clinicIdRaw: clinicId, threshold: triggerThreshold, current: currentNumber }
  });
  const notifications = usersToNotify.filter(user => user.fcmToken).map(user => FCMService.sendQueueNotification(user.id, currentNumber, currentNumber + 1, '', ''));
  return Promise.allSettled(notifications);
};

export const updateUserSubscription = async (userId, clinicId, fcmToken) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  const subscriptions = new Set(user.subscribedClinics || []);
  subscriptions.add(clinicId);
  await user.update({ subscribedClinics: Array.from(subscriptions), fcmToken: fcmToken || user.fcmToken });
  return true;
};

export const notifyPatientReportReady = async (report) => {
  try {
    if (!report?.patientId) return;
    await FCMService.sendReportNotification(report.patientId, report.clinic?.name || 'Clinic', report.doctor?.name || 'Doctor', report.title || 'Medical Report');
  } catch (err) { console.error('Report notification failed:', err.message); }
};
