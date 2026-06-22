import cron from 'node-cron';
import Clinic from '../models/Clinic.js';
import { resetAllDoctorQueuesForClinic } from '../utils/queueReset.js';
import redisClient from '../config/redis.js';

let task;

const checkClinicHours = async () => {
  try {
    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: process.env.APP_TIMEZONE || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    const clinics = await Clinic.findAll({});

    for (const clinic of clinics) {
      const { opening, closing } = clinic.operatingHours;
      const isWithinHours = currentTime >= opening && currentTime < closing;

      try {
        if (!isWithinHours && clinic.isOpen) {
          await resetAllDoctorQueuesForClinic(clinic.id);
          clinic.isOpen = false;
          clinic.manuallyClosed = false;
          clinic.lastStatusChange = new Date();
          await clinic.save();
          if (redisClient.isOpen) {
            await redisClient.del(`clinic:${clinic.id}:status`);
            await redisClient.del('clinics:public:list');
          }
          console.log(`Auto-closed clinic "${clinic.name}" outside operating hours`);
        }
      } catch (clinicError) {
        console.error(`Error processing clinic ${clinic.name}:`, clinicError.message);
      }
    }
  } catch (error) {
    console.error('Clinic hours check error:', error.message);
  }
};

// Run one scheduler per deployment. If the API is scaled horizontally, move
// this job to EventBridge Scheduler or a dedicated worker.
export const startClinicHoursResetJob = () => {
  if (task) return task;
  task = cron.schedule('*/5 * * * *', checkClinicHours, {
    timezone: process.env.APP_TIMEZONE || 'UTC'
  });
  return task;
};

export const stopClinicHoursResetJob = () => {
  task?.stop();
  task = undefined;
};
