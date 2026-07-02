import {
  getSelectedDoctorId,
  loadQueueSnapshot,
  saveQueueSnapshot,
  saveSelectedDoctorId
} from './queueSnapshot';

beforeEach(() => {
  sessionStorage.clear();
});

test('restores queue data after a page reload in the same browser tab', () => {
  const queue = {
    current: 7,
    upcoming: [{ id: 'queue-8', number: 8 }],
    totalWaiting: 1,
    canCallNext: true
  };

  saveQueueSnapshot('clinic-1', 'doctor-1', queue);

  expect(loadQueueSnapshot('clinic-1', 'doctor-1')?.data).toEqual(queue);
});

test('keeps queue snapshots isolated by clinic and doctor', () => {
  saveQueueSnapshot('clinic-1', 'doctor-1', { current: 1 });
  saveQueueSnapshot('clinic-1', 'doctor-2', { current: 9 });

  expect(loadQueueSnapshot('clinic-1', 'doctor-1')?.data.current).toBe(1);
  expect(loadQueueSnapshot('clinic-1', 'doctor-2')?.data.current).toBe(9);
});

test('restores the selected doctor for the clinic', () => {
  saveSelectedDoctorId('clinic-1', 'doctor-2');

  expect(getSelectedDoctorId('clinic-1')).toBe('doctor-2');
});
