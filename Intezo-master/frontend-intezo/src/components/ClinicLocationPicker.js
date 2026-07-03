import React, { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import './ClinicLocationPrompt.scss';

const DEFAULT_CENTER = [67.0011, 24.8607];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLocation = location => {
  if (!location) return null;
  const latitude = toNumber(location.latitude);
  const longitude = toNumber(location.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
};

const ClinicLocationPicker = ({
  initialLocation = null,
  onSave,
  saving = false,
  error = '',
  saveLabel = 'Save clinic location'
}) => {
  const startLocation = normalizeLocation(initialLocation);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const placeMarkerRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(startLocation);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
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
          center: startLocation
            ? [startLocation.longitude, startLocation.latitude]
            : DEFAULT_CENTER,
          zoom: startLocation ? 16 : 11
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        const placeMarker = (longitude, latitude) => {
          if (!markerRef.current) {
            markerRef.current = new maplibregl.Marker({ color: '#ef6235', draggable: true })
              .setLngLat([longitude, latitude])
              .addTo(map);
            markerRef.current.on('dragend', () => {
              const position = markerRef.current.getLngLat();
              setSelectedLocation({ latitude: position.lat, longitude: position.lng });
            });
          } else {
            markerRef.current.setLngLat([longitude, latitude]);
          }
        };
        placeMarkerRef.current = placeMarker;

        if (startLocation) {
          placeMarker(startLocation.longitude, startLocation.latitude);
        }

        map.on('click', event => {
          placeMarker(event.lngLat.lng, event.lngLat.lat);
          setSelectedLocation({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
          setMapError('');
        });

        mapRef.current = map;
      } catch {
        setMapError('The map could not be loaded. You can still use your current location.');
      }
    };

    initializeMap();
    return () => {
      disposed = true;
      markerRef.current = null;
      placeMarkerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapError('Location is not supported by this browser. Please click your clinic on the map.');
      return;
    }

    setLocating(true);
    setMapError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setSelectedLocation(location);
        mapRef.current?.flyTo({ center: [location.longitude, location.latitude], zoom: 16 });
        placeMarkerRef.current?.(location.longitude, location.latitude);
        setLocating(false);
      },
      locationError => {
        setLocating(false);
        setMapError(
          locationError.code === locationError.PERMISSION_DENIED
            ? 'Location permission was denied. Please click your clinic position on the map.'
            : 'Could not find your location. Please select it on the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const shownError = mapError || error;

  return (
    <>
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
            ? `${Number(selectedLocation.latitude).toFixed(6)}, ${Number(selectedLocation.longitude).toFixed(6)}`
            : 'Click the exact clinic position on the map'}
        </span>
      </div>

      {shownError && <div className="clinic-location-error">{shownError}</div>}

      <div className="clinic-location-actions">
        <button
          type="button"
          className="clinic-location-save"
          onClick={() => onSave(selectedLocation)}
          disabled={!selectedLocation || saving}
        >
          {saving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </>
  );
};

export default ClinicLocationPicker;
