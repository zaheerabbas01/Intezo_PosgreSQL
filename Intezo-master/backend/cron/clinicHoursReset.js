import cron from 'node-cron';
import Clinic from '../models/Clinic.js';
import { resetAllDoctorQueuesForClinic } from '../utils/queueReset.js';

// Check every 5 minutes for clinics outside operating hours
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    // Get all clinics
    const clinics = await Clinic.findAll({});
    
    for (const clinic of clinics) {
      const openingTime = clinic.operatingHours.opening;
      const closingTime = clinic.operatingHours.closing;
      const isWithinHours = currentTime >= openingTime && currentTime < closingTime;
      
      // Close clinic if outside operating hours and currently open
      if (!isWithinHours && clinic.isOpen) {
        try {
          const resetCount = await resetAllDoctorQueuesForClinic(clinic.id);
          
          clinic.isOpen = false;
          clinic.lastStatusChange = new Date();
          await clinic.save();
        } catch (clinicError) {
          console.error(`❌ Error processing clinic ${clinic.name}:`, clinicError.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Clinic hours check error:', err.message);
  }
});

export default cron;