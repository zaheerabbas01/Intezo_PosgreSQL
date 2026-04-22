import cron from 'node-cron';
import { performDailyReset } from '../utils/queueReset.js';

// Run at midnight every day
cron.schedule('0 0 * * *', performDailyReset);

export default cron;