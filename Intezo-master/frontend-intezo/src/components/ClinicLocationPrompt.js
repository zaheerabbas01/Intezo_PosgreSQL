import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { updateClinicLocation } from '../api/clinicApi';
import { useAuth } from '../context/AuthContext';
import ClinicLocationPicker from './ClinicLocationPicker';
import './ClinicLocationPrompt.scss';

const hasValidCoordinates = clinic => (
  clinic?.latitude !== null &&
  clinic?.latitude !== undefined &&
  clinic?.longitude !== null &&
  clinic?.longitude !== undefined &&
  Number.isFinite(Number(clinic?.latitude)) &&
  Number.isFinite(Number(clinic?.longitude))
);

const ClinicLocationPrompt = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const clinic = currentUser?.clinic;
  const isClinicPortal = pathname.startsWith('/clinic/') &&
    !pathname.endsWith('/login') &&
    !pathname.endsWith('/register');
  const shouldShow = Boolean(
    clinic &&
    isClinicPortal &&
    !dismissed &&
    !hasValidCoordinates(clinic)
  );

  const saveLocation = async selectedLocation => {
    if (!selectedLocation) {
      setError('Select your clinic location on the map first.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await updateClinicLocation(
        selectedLocation.latitude,
        selectedLocation.longitude
      );
      const updatedUser = {
        ...currentUser,
        clinic: { ...clinic, ...response.data.location }
      };
      localStorage.setItem('clinicUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
    } catch (saveError) {
      setError(saveError.response?.data?.error || 'Unable to save clinic location.');
    } finally {
      setSaving(false);
    }
  };

  if (!shouldShow) return null;

  return (
    <div className="clinic-location-overlay" role="dialog" aria-modal="true">
      <div className="clinic-location-modal">
        <div className="clinic-location-header">
          <div>
            <h2>Set your clinic on the map</h2>
            <p>Patients can only find your clinic nearby after its location is saved.</p>
          </div>
          <button
            type="button"
            className="clinic-location-later"
            onClick={() => setDismissed(true)}
          >
            Remind me later
          </button>
        </div>

        <ClinicLocationPicker onSave={saveLocation} saving={saving} error={error} />
      </div>
    </div>
  );
};

export default ClinicLocationPrompt;
