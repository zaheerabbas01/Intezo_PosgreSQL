import * as notificationService from './notification.service';

export const subscribeToQueue = async (req, res) => {
  try {
    const { clinicId, fcmToken } = req.body;
    const userId = req.user.id;

    if (!clinicId) return res.status(400).json({ error: 'Clinic ID required' });

    await notificationService.updateUserSubscription(userId, clinicId, fcmToken);

    res.json({ 
      success: true, 
      message: 'Successfully subscribed to queue updates' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};