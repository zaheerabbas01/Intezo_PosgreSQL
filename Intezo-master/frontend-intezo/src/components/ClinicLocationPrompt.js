import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import { updateClinicLocation } from '../api/clinicApi';
import { useAuth } from '../context/AuthContext';
import './ClinicLocationPrompt.scss';

const DEFAULT_CENTER = [67.0011, 24.8607];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
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

  useEffect(() => {
    if (!shouldShow || !mapContainerRef.current || mapRef.current) return;
    let disposed = false;
    let map = null;

    const initializeMap = async () => {
      try {
        const module = await import('maplibre-gl');
        if (disposed || !mapContainerRef.current) return;
        const maplibregl = module.default || module;

        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: MAP_STYLE,
          center: DEFAULT_CENTER,
          zoom: 11
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        const setMarkerLocation = (longitude, latitude) => {
          const location = { latitude, longitude };
          setSelectedLocation(location);
          if (!markerRef.current) {
            markerRef.current = new maplibregl.Marker({ color: '#2563eb', draggable: true })
              .setLngLat([longitude, latitude])
              .addTo(map);
            markerRef.current.on('dragend', () => {
              const position = markerRef.current.getLngLat();
              setSelectedLocation({
                latitude: position.lat,
                longitude: position.lng
              });
            });
          } else {
            markerRef.current.setLngLat([longitude, latitude]);
          }
        };

        map.on('click', event => {
          setMarkerLocation(event.lngLat.lng, event.lngLat.lat);
          setError('');
        });

        mapRef.current = map;
      } catch {
        setError('The map could not be loaded. You can still use your current location.');
      }
    };

    initializeMap();
    return () => {
      disposed = true;
      markerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, [shouldShow]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported by this browser. Please click your clinic on the map.');
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setSelectedLocation(location);
        mapRef.current?.flyTo({
          center: [location.longitude, location.latitude],
          zoom: 16
        });
        if (!markerRef.current && mapRef.current) {
          import('maplibre-gl').then(module => {
            if (!mapRef.current || markerRef.current) return;
            const maplibregl = module.default || module;
            markerRef.current = new maplibregl.Marker({ color: '#2563eb', draggable: true })
              .setLngLat([location.longitude, location.latitude])
              .addTo(mapRef.current);
            markerRef.current.on('dragend', () => {
              const markerPosition = markerRef.current.getLngLat();
              setSelectedLocation({
                latitude: markerPosition.lat,
                longitude: markerPosition.lng
              });
            });
          });
        } else {
          markerRef.current?.setLngLat([location.longitude, location.latitude]);
        }
        setLocating(false);
      },
      locationError => {
        setLocating(false);
        setError(
          locationError.code === locationError.PERMISSION_DENIED
            ? 'Location permission was denied. Please click your clinic position on the map.'
            : 'Could not find your location. Please select it on the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const saveLocation = async () => {
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
        clinic: {
          ...clinic,
          ...response.data.location
        }
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

        <div ref={mapContainerRef} className="clinic-location-map" />

        <div className="clinic-location-controls">
          <button
            type="button"
            className="clinic-location-detect"
            onClick={useCurrentLocation}
            disabled={locating || saving}
          >
            {locating ? 'Finding location...' : 'Use my current location'}
          </button>
          <span>
            {selectedLocation
              ? `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
              : 'Click the exact clinic position on the map'}
          </span>
        </div>

        {error && <div className="clinic-location-error">{error}</div>}

        <div className="clinic-location-actions">
          <button
            type="button"
            className="clinic-location-save"
            onClick={saveLocation}
            disabled={!selectedLocation || saving}
          >
            {saving ? 'Saving...' : 'Save clinic location'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicLocationPrompt;
