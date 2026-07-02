const SNAPSHOT_PREFIX = 'intezo.queue.snapshot';
const SELECTED_DOCTOR_PREFIX = 'intezo.queue.selectedDoctor';

const buildKey = (prefix, clinicId, doctorId) => {
  if (!clinicId) return null;
  return doctorId ? `${prefix}.${clinicId}.${doctorId}` : `${prefix}.${clinicId}`;
};

export const loadQueueSnapshot = (clinicId, doctorId) => {
  const key = buildKey(SNAPSHOT_PREFIX, clinicId, doctorId);
  if (!key) return null;

  try {
    const snapshot = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!snapshot?.data || !snapshot.savedAt) return null;
    return snapshot;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
};

export const saveQueueSnapshot = (clinicId, doctorId, data) => {
  const key = buildKey(SNAPSHOT_PREFIX, clinicId, doctorId);
  if (!key || !data) return;

  try {
    sessionStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Queue rendering must continue even if browser storage is unavailable.
  }
};

export const getSelectedDoctorId = (clinicId) => {
  const key = buildKey(SELECTED_DOCTOR_PREFIX, clinicId);
  if (!key) return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const saveSelectedDoctorId = (clinicId, doctorId) => {
  const key = buildKey(SELECTED_DOCTOR_PREFIX, clinicId);
  if (!key || !doctorId) return;
  try {
    sessionStorage.setItem(key, doctorId);
  } catch {
    // Selection persistence is an enhancement, not a requirement.
  }
};
