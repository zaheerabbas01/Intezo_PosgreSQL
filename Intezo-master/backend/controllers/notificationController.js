import User from '../models/User.js';
import { sendPushNotification } from '../services/notification.js';
import sequelize from '../config/database.js';
import { Op } from 'sequelize';

// Subscribe to queue updates
export const subscribeToQueue = async (req, res) => {
  const { clinicId, fcmToken } = req.body;
  const userId = req.user.userId;

  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Add clinic to subscribedClinics array if not already present
  const subscribedClinics = user.subscribedClinics || [];
  if (!subscribedClinics.includes(clinicId)) {
    subscribedClinics.push(clinicId);
  }

  await user.update({
    subscribedClinics,
    fcmToken
  });

  res.json({ success: true });
};

// Handle FCM notifications (called from services)
export const handleQueueNotification = async (clinicId, triggerNumber) => {
  const users = await User.findAll({
    where: sequelize.literal(`subscribedClinics @> :clinicFilter AND queues @> :queueFilter`),
    replacements: {
      clinicFilter: JSON.stringify([clinicId]),
      queueFilter: JSON.stringify([{ number: { $lte: triggerNumber + 5 } }])
    }
  });

  await Promise.all(
    users.map(user => 
      sendPushNotification({
        to: user.fcmToken,
        title: 'Your turn is coming!',
        body: `Number ${triggerNumber} is being served`
      })
    )
  );
};
