import cron from 'node-cron';
import { performDailyReset } from '../utils/queueReset.js';

let task;

export const startDailyResetJob = () => {
  if (task) return task;
  task = cron.schedule('0 0 * * *', performDailyReset, {
    timezone: process.env.APP_TIMEZONE || 'UTC'
  });
  return task;
};

export const stopDailyResetJob = () => {
  task?.stop();
  task = undefined;
};
