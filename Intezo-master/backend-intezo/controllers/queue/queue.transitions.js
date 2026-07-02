export const resolveAdvanceNumber = ({ action, currentServing, nextPatientNumber }) => {
  if (action === 'skip' && currentServing === 0) {
    throw new Error('NO_CURRENT_PATIENT');
  }

  if (nextPatientNumber !== null && nextPatientNumber !== undefined) {
    return nextPatientNumber;
  }

  if (currentServing > 0) {
    return currentServing;
  }

  throw new Error('NO_MORE_PATIENTS');
};

export const shouldServeCurrentPatient = ({
  action,
  currentServing,
  newNumber,
  hasCurrentQueue,
  hasFollowingPatient
}) => (
  action !== 'skip' &&
  hasCurrentQueue &&
  currentServing > 0 &&
  (
    Number(newNumber) !== currentServing ||
    (action === 'next' && !hasFollowingPatient)
  )
);
