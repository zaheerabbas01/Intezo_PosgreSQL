// src/pages/Doctors.js
import React, { useState, useEffect, useMemo } from 'react';
import api, { getDoctors, updateDoctor, deleteDoctor, getDoctorQueueStatus, getAvailableDoctors, addDoctorToClinic } from '../api/clinicApi';
import '../styles/Doctors.scss';
import '../styles/DoctorModal.scss';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/PusherContext';

const Doctors = () => {
    const [doctors, setDoctors] = useState([]);
    const [availableDoctors, setAvailableDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [formData, setFormData] = useState({
        consultationFee: '',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        availableHours: {
            start: '09:00',
            end: '17:00'
        }
    });
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [selectedDoctorForModal, setSelectedDoctorForModal] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showSettingsInModal, setShowSettingsInModal] = useState(false);
    const [isAddingDoctor, setIsAddingDoctor] = useState(false);
    const [loadingAvailableDoctors, setLoadingAvailableDoctors] = useState(false);
    const navigate = useNavigate();
    const { socket, joinClinic, subscribe } = useSocket();

    const toggleAvailability = async (doctorId, isAvailable) => {
        try {
            const response = await api.patch(`/doctors/${doctorId}/availability`, {
                isAvailable
            });

            if (response.data.success) {
                fetchDoctors();
                alert(`Doctor ${isAvailable ? 'made available' : 'made unavailable'} successfully`);
            }
        } catch (err) {
            console.error('Error updating doctor availability:', err);
            if (err.response?.status === 401) {
                setError('You do not have permission to update this doctor\'s availability');
            } else {
                setError('Failed to update doctor availability');
            }
        }
    };

    const viewDoctorDashboard = (doctorId) => {
        navigate(`/clinic/doctor-dashboard/${doctorId}`);
    };

    useEffect(() => {
        fetchDoctors();
        fetchAvailableDoctors();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const user = JSON.parse(localStorage.getItem('clinicUser') || 'null');
        const clinicId = user?.clinic?.id;
        
        if (!clinicId) return;

        joinClinic(clinicId);
        
        const unsubscribe = subscribe('doctor_status_changed', (data) => {
            setDoctors(prevDoctors => 
                prevDoctors.map(doctor => 
                    doctor.id === data.doctorId 
                        ? { ...doctor, isAvailable: data.isAvailable, lastStatusChange: data.lastStatusChange }
                        : doctor
                )
            );
        });

        return unsubscribe;
    }, [socket, joinClinic, subscribe]);

    const fetchAvailableDoctors = async () => {
        try {
            setLoadingAvailableDoctors(true);
            console.log('Fetching available doctors...');
            const response = await getAvailableDoctors();
            console.log('Available doctors response:', response.data);
            setAvailableDoctors(response.data);
        } catch (err) {
            console.error('Error fetching available doctors:', err);
            setError('Failed to fetch available doctors');
        } finally {
            setLoadingAvailableDoctors(false);
        }
    };

    const fetchDoctors = async () => {
        try {
            setLoading(true);
            const response = await getDoctors();
            console.log('Fetch doctors response:', response);
            console.log('Doctors data:', response.data);
            const doctorsData = response.data;
            
            // Fetch queue status for each doctor
            const doctorsWithQueueData = await Promise.all(
                doctorsData.map(async (doctor) => {
                    try {
                        const queueResponse = await getDoctorQueueStatus(doctor.id);
                        return {
                            ...doctor,
                            queueData: {
                                currentServing: queueResponse.data.currentNumber || 0,
                                totalWaiting: queueResponse.data.totalWaiting || 0
                            }
                        };
                    } catch (err) {
                        console.error(`Error fetching queue status for doctor ${doctor.id}:`, err);
                        return {
                            ...doctor,
                            queueData: {
                                currentServing: 0,
                                totalWaiting: 0
                            }
                        };
                    }
                })
            );
            
            setDoctors(doctorsWithQueueData);
            setError('');
        } catch (err) {
            setError('Failed to fetch doctors');
            console.error('Error fetching doctors:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'startTime' || name === 'endTime') {
            setFormData(prev => ({
                ...prev,
                availableHours: {
                    ...prev.availableHours,
                    [name === 'startTime' ? 'start' : 'end']: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleDayToggle = (day) => {
        setFormData(prev => {
            const days = [...prev.availableDays];
            if (days.includes(day)) {
                return {
                    ...prev,
                    availableDays: days.filter(d => d !== day)
                };
            } else {
                return {
                    ...prev,
                    availableDays: [...days, day]
                };
            }
        });
    };

    const handleAddDoctor = async (e) => {
        e.preventDefault();
        
        // Check if doctor is selected
        if (!selectedDoctor || !selectedDoctor.id) {
            setError('Please select a doctor first');
            return;
        }
        
        // Validate form data
        if (!formData.consultationFee || formData.consultationFee <= 0) {
            setError('Please enter a valid consultation fee');
            return;
        }
        
        if (!formData.availableDays || formData.availableDays.length === 0) {
            setError('Please select at least one available day');
            return;
        }
        
        if (!formData.availableHours.start || !formData.availableHours.end) {
            setError('Please set valid available hours');
            return;
        }
        
        if (formData.availableHours.start >= formData.availableHours.end) {
            setError('End time must be after start time');
            return;
        }
        
        try {
            setError(''); // Clear any previous errors
            setIsAddingDoctor(true);
            
            const doctorData = {
                doctorId: selectedDoctor.id,
                consultationFee: parseFloat(formData.consultationFee),
                availableDays: formData.availableDays,
                availableHours: formData.availableHours
            };
            
            console.log('Adding doctor to clinic with data:', doctorData);
            const response = await addDoctorToClinic(doctorData);
            
            if (response.data) {
                console.log('Doctor added successfully:', response.data);
                setShowAddModal(false);
                setSelectedDoctor(null);
                resetForm();
                await fetchDoctors();
                await fetchAvailableDoctors();
                // Show success message
                alert('Doctor added to clinic successfully!');
            }
        } catch (err) {
            console.error('Error adding doctor:', err);
            console.error('Error response:', err.response?.data);
            const errorMessage = err.response?.data?.error || err.message || 'Failed to add doctor to clinic';
            setError(errorMessage);
        } finally {
            setIsAddingDoctor(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateDoctor(editingDoctor.id, formData);
            setShowEditForm(false);
            setEditingDoctor(null);
            resetForm();
            fetchDoctors();
        } catch (err) {
            setError('Failed to update doctor');
            console.error('Error updating doctor:', err);
        }
    };

    const resetForm = () => {
        setFormData({
            consultationFee: '',
            availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            availableHours: {
                start: '09:00',
                end: '17:00'
            }
        });
    };

    const handleEdit = (doctor) => {
        setEditingDoctor(doctor);
        setFormData({
            consultationFee: doctor.consultationFee,
            availableDays: doctor.availableDays,
            availableHours: doctor.availableHours
        });
        setShowEditForm(true);
    };

    const selectDoctor = (doctor) => {
        console.log('Doctor selected:', doctor);
        if (!doctor || !doctor.id) {
            setError('Invalid doctor selection');
            return;
        }
        setSelectedDoctor(doctor);
        setShowAddModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this doctor?')) {
            try {
                await deleteDoctor(id);
                fetchDoctors();
            } catch (err) {
                setError('Failed to delete doctor');
                console.error('Error deleting doctor:', err);
            }
        }
    };

    const cancelAddModal = () => {
        setShowAddModal(false);
        setSelectedDoctor(null);
        setIsAddingDoctor(false);
        setError('');
        resetForm();
    };

    const cancelEditForm = () => {
        setShowEditForm(false);
        setEditingDoctor(null);
        resetForm();
    };
    
    const handleDoctorClick = (doctor) => {
        setSelectedDoctorForModal(doctor);
        setShowDoctorModal(true);
        setShowSettingsInModal(false);
    };
    
    const handleEditInModal = (doctor) => {
        setFormData({
            consultationFee: doctor.consultationFee,
            availableDays: doctor.availableDays,
            availableHours: doctor.availableHours
        });
        setShowSettingsInModal(true);
    };
    
    const handleUpdateInModal = async (e) => {
        e.preventDefault();
        try {
            await updateDoctor(selectedDoctorForModal.id, formData);
            setShowSettingsInModal(false);
            fetchDoctors();
            // Update the modal data
            const updatedDoctor = { ...selectedDoctorForModal, ...formData };
            setSelectedDoctorForModal(updatedDoctor);
        } catch (err) {
            setError('Failed to update doctor');
            console.error('Error updating doctor:', err);
        }
    };
    
    const getFilteredAndSortedDoctors = useMemo(() => {
        let filteredDoctors = doctors;
        
        // Apply search filter
        if (searchTerm) {
            filteredDoctors = filteredDoctors.filter(doctor => 
                doctor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doctor.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doctor.specialties?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        
        // Apply status filter
        if (filterBy !== 'all') {
            filteredDoctors = filteredDoctors.filter(doctor => {
                switch (filterBy) {
                    case 'available':
                        return doctor.isAvailable;
                    case 'unavailable':
                        return !doctor.isAvailable;
                    case 'active':
                        return doctor.isActive;
                    case 'inactive':
                        return !doctor.isActive;
                    default:
                        return true;
                }
            });
        }
        
        // Apply sorting
        filteredDoctors.sort((a, b) => {
            let aValue, bValue;
            
            switch (sortBy) {
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'fee':
                    aValue = a.consultationFee || 0;
                    bValue = b.consultationFee || 0;
                    break;
                case 'patients':
                    aValue = a.queueData?.totalWaiting || 0;
                    bValue = b.queueData?.totalWaiting || 0;
                    break;
                default:
                    return 0;
            }
            
            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return filteredDoctors;
    }, [doctors, searchTerm, filterBy, sortBy, sortOrder]);

    if (loading) {
        return <div className="loading">Loading doctors...</div>;
    }

    return (
        <div className="doctors-page">
            <div className="page-header">
                <h1>Doctors Management</h1>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            console.log('Add Doctor button clicked');
                            console.log('Available doctors:', availableDoctors);
                            setShowAddModal(true);
                        }}
                        disabled={loading}
                    >
                        + Add Doctor
                    </button>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            
            {/* Quick Stats */}
            <div className="doctors-stats">
                <div className="stat-card total">
                    <div className="stat-number">{doctors.length}</div>
                    <div className="stat-label">Total Doctors</div>
                </div>
                <div className="stat-card available">
                    <div className="stat-number">{doctors.filter(d => d.isAvailable).length}</div>
                    <div className="stat-label">Available</div>
                </div>
                <div className="stat-card busy">
                    <div className="stat-number">{doctors.filter(d => d.queueData?.totalWaiting > 0).length}</div>
                    <div className="stat-label">With Patients</div>
                </div>
                <div className="stat-card total-waiting">
                    <div className="stat-number">{doctors.reduce((sum, d) => sum + (d.queueData?.totalWaiting || 0), 0)}</div>
                    <div className="stat-label">Total Waiting</div>
                </div>
            </div>
            
            {/* Search and Filters */}
            <div className="doctors-controls">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search doctors by name or specialty..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button className="search-clear" onClick={() => setSearchTerm('')}>
                            ×
                        </button>
                    )}
                </div>
                <div className="filters">
                    <select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
                        <option value="all">All Doctors</option>
                        <option value="available">Available</option>
                        <option value="unavailable">Unavailable</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="name">Sort by Name</option>
                        <option value="fee">Sort by Fee</option>
                        <option value="patients">Sort by Patients</option>
                    </select>
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
            </div>

            {showAddModal && (
                <div className="doctor-form-overlay">
                    <div className="doctor-form">
                        <h2>Add Doctor to Clinic</h2>
                        {!selectedDoctor ? (
                            <div className="available-doctors">
                                <h3>Select a Doctor to Add</h3>
                                {loadingAvailableDoctors ? (
                                    <div className="loading-doctors">
                                        <div className="loading-spinner">⏳</div>
                                        <p>Loading available doctors...</p>
                                    </div>
                                ) : availableDoctors.length === 0 ? (
                                    <div className="no-doctors-message">
                                        <div className="empty-icon">👨‍⚕️</div>
                                        <p><strong>No available doctors found</strong></p>
                                        <p>All registered doctors are already in your clinic, or no doctors have registered in the system yet.</p>
                                        <div className="action-buttons">
                                            <button 
                                                type="button" 
                                                className="btn btn-info"
                                                onClick={() => {
                                                    console.log('Refreshing available doctors...');
                                                    fetchAvailableDoctors();
                                                }}
                                                disabled={loadingAvailableDoctors}
                                            >
                                                {loadingAvailableDoctors ? '⏳ Loading...' : '🔄 Refresh List'}
                                            </button>
                                            <button type="button" className="btn btn-secondary" onClick={cancelAddModal}>
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="instruction-text">Click on a doctor below to add them to your clinic:</p>
                                        <div className="doctors-grid">
                                            {availableDoctors.map(doctor => (
                                                <div key={doctor.id} className="doctor-option" onClick={() => selectDoctor(doctor)}>
                                                    <div className="doctor-header">
                                                        <h4>{doctor.name}</h4>
                                                        <span className="doctor-badge">Available</span>
                                                    </div>
                                                    <div className="doctor-details">
                                                        <p><strong>Specialties:</strong> {doctor.specialties?.join(', ') || 'General Practice'}</p>
                                                        <p><strong>License:</strong> {doctor.licenseNumber}</p>
                                                        <p><strong>Email:</strong> {doctor.email}</p>
                                                        {doctor.phone && <p><strong>Phone:</strong> {doctor.phone}</p>}
                                                    </div>
                                                    <div className="select-button">
                                                        <span>Click to Select</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="modal-footer">
                                            <button 
                                                type="button" 
                                                className="btn btn-info"
                                                onClick={() => {
                                                    console.log('Refreshing available doctors...');
                                                    fetchAvailableDoctors();
                                                }}
                                                disabled={loadingAvailableDoctors}
                                            >
                                                {loadingAvailableDoctors ? '⏳ Loading...' : '🔄 Refresh List'}
                                            </button>
                                            <button type="button" className="btn btn-secondary" onClick={cancelAddModal}>
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleAddDoctor}>
                                <div className="selected-doctor">
                                    <h3>Selected Doctor</h3>
                                    <p><strong>{selectedDoctor.name}</strong></p>
                                    <p>Specialties: {selectedDoctor.specialties?.join(', ')}</p>
                                    <p>Qualifications: {selectedDoctor.qualifications?.map(q => `${q.degree} (${q.year})`).join(', ')}</p>
                                </div>

                                {error && <div className="error-message" style={{marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.875rem'}}>{error}</div>}

                                <div className="form-group">
                                    <label>Consultation Fee (Required) *</label>
                                    <input
                                        type="number"
                                        name="consultationFee"
                                        value={formData.consultationFee}
                                        onChange={handleInputChange}
                                        min="1"
                                        step="0.01"
                                        placeholder="Enter consultation fee"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Available Days (Select at least one) *</label>
                                    <div className="days-checkboxes">
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                            <label key={day} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.availableDays.includes(day)}
                                                    onChange={() => handleDayToggle(day)}
                                                />
                                                {day}
                                            </label>
                                        ))}
                                    </div>
                                    {formData.availableDays.length === 0 && (
                                        <small style={{color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block'}}>
                                            Please select at least one day
                                        </small>
                                    )}
                                </div>

                                <div className="form-group time-range">
                                    <label>Available Hours *</label>
                                    <div className="time-inputs">
                                        <input
                                            type="time"
                                            name="startTime"
                                            value={formData.availableHours.start}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <span>to</span>
                                        <input
                                            type="time"
                                            name="endTime"
                                            value={formData.availableHours.end}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    {formData.availableHours.start && formData.availableHours.end && formData.availableHours.start >= formData.availableHours.end && (
                                        <small style={{color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block'}}>
                                            End time must be after start time
                                        </small>
                                    )}
                                </div>

                                <div className="form-actions">
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                        disabled={isAddingDoctor || formData.availableDays.length === 0 || !formData.consultationFee}
                                    >
                                        {isAddingDoctor ? 'Adding Doctor...' : 'Add Doctor'}
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        onClick={cancelAddModal}
                                        disabled={isAddingDoctor}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {showEditForm && (
                <div className="doctor-form-overlay">
                    <div className="doctor-form">
                        <h2>Edit Doctor Settings</h2>
                        <form onSubmit={handleEditSubmit}>
                            <div className="selected-doctor">
                                <h3>{editingDoctor.name}</h3>
                                <p>Specialties: {editingDoctor.specialties?.join(', ')}</p>
                            </div>

                            <div className="form-group">
                                <label>Consultation Fee</label>
                                <input
                                    type="number"
                                    name="consultationFee"
                                    value={formData.consultationFee}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Available Days</label>
                                <div className="days-checkboxes">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                        <label key={day} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.availableDays.includes(day)}
                                                onChange={() => handleDayToggle(day)}
                                            />
                                            {day}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group time-range">
                                <label>Available Hours</label>
                                <div className="time-inputs">
                                    <input
                                        type="time"
                                        name="startTime"
                                        value={formData.availableHours.start}
                                        onChange={handleInputChange}
                                    />
                                    <span>to</span>
                                    <input
                                        type="time"
                                        name="endTime"
                                        value={formData.availableHours.end}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary">
                                    Update Doctor
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={cancelEditForm}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="doctors-list-compact">
                {getFilteredAndSortedDoctors.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">👨‍⚕️</div>
                        <h3>
                            {searchTerm ? 'No doctors match your search' : 'No doctors in your clinic yet'}
                        </h3>
                        <p>
                            {searchTerm 
                                ? 'Try adjusting your search criteria' 
                                : availableDoctors.length > 0 
                                    ? 'Add registered doctors to get started.' 
                                    : 'No registered doctors available to add.'}
                        </p>
                        {!searchTerm && availableDoctors.length > 0 && (
                            <button 
                                className="btn btn-primary"
                                onClick={() => setShowAddModal(true)}
                            >
                                Add First Doctor
                            </button>
                        )}
                    </div>
                ) : (
                    getFilteredAndSortedDoctors.map(doctor => (
                        <div 
                            key={doctor.id} 
                            className="doctor-row"
                            onClick={() => handleDoctorClick(doctor)}
                        >
                            <div className="doctor-basic-info">
                                <div className="doctor-name">{doctor.name}</div>
                                <div className="doctor-specialty">{doctor.specialty || doctor.specialties?.join(', ')}</div>
                            </div>
                            <div className="doctor-fee">
                                <span className="fee-amount">${doctor.consultationFee}</span>
                            </div>
                            <div className="doctor-status">
                                <span className={`status-badge ${doctor.isAvailable ? 'available' : 'unavailable'}`}>
                                    {doctor.isAvailable ? 'Available' : 'Unavailable'}
                                </span>
                            </div>
                            <div className="doctor-queue">
                                <div className="queue-stats">
                                    <span className="serving">Serving: {doctor.queueData?.currentServing || 0}</span>
                                    <span className="waiting">Waiting: {doctor.queueData?.totalWaiting || 0}</span>
                                </div>
                            </div>
                            <div className="doctor-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className={`btn-xs ${doctor.isAvailable ? 'btn-warning' : 'btn-success'}`}
                                    onClick={() => toggleAvailability(doctor.id, !doctor.isAvailable)}
                                    title={doctor.isAvailable ? 'Make unavailable' : 'Make available'}
                                >
                                    {doctor.isAvailable ? '⏸️' : '▶️'}
                                </button>
                                <button
                                    className="btn-xs btn-info"
                                    onClick={() => viewDoctorDashboard(doctor.id)}
                                    title="View dashboard"
                                >
                                    📈
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {/* Doctor Detail Modal */}
            {showDoctorModal && selectedDoctorForModal && (
                <div className="modal-overlay">
                    <div className="modal-content doctor-detail-modal">
                        <div className="modal-header">
                            <h2>Doctor Details</h2>
                            <button
                                className="close-modal"
                                onClick={() => setShowDoctorModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="doctor-detail-content">
                            <div className="detail-section">
                                <h3>Basic Information</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <span className="label">Name:</span>
                                        <span className="value">{selectedDoctorForModal.name}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Specialty:</span>
                                        <span className="value">{selectedDoctorForModal.specialty || selectedDoctorForModal.specialties?.join(', ')}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Consultation Fee:</span>
                                        <span className="value fee-badge">${selectedDoctorForModal.consultationFee}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Status:</span>
                                        <div className="status-badges">
                                            <span className={`status-badge ${selectedDoctorForModal.isActive ? 'active' : 'inactive'}`}>
                                                {selectedDoctorForModal.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                            <span className={`status-badge ${selectedDoctorForModal.isAvailable ? 'available' : 'unavailable'}`}>
                                                {selectedDoctorForModal.isAvailable ? 'Available' : 'Unavailable'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="detail-section">
                                <h3>Availability</h3>
                                <div className="availability-info">
                                    <div className="days">
                                        <span className="label">Available Days:</span>
                                        <div className="days-list">
                                            {selectedDoctorForModal.availableDays?.map((day, index) => (
                                                <span key={`${day}-${index}`} className="day-badge">{day}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="hours">
                                        <span className="label">Available Hours:</span>
                                        <span className="time-range">
                                            {selectedDoctorForModal.availableHours?.start} - {selectedDoctorForModal.availableHours?.end}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="detail-section">
                                <h3>Current Queue Status</h3>
                                <div className="queue-detail">
                                    <div className="queue-stat">
                                        <span className="stat-number serving">{selectedDoctorForModal.queueData?.currentServing || 0}</span>
                                        <span className="stat-label">Currently Serving</span>
                                    </div>
                                    <div className="queue-stat">
                                        <span className="stat-number waiting">{selectedDoctorForModal.queueData?.totalWaiting || 0}</span>
                                        <span className="stat-label">Patients Waiting</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Settings Form */}
                            {showSettingsInModal && (
                                <div className="settings-form">
                                    <h3>Edit Settings</h3>
                                    <form onSubmit={handleUpdateInModal}>
                                        <div className="form-group">
                                            <label>Consultation Fee</label>
                                            <input
                                                type="number"
                                                name="consultationFee"
                                                value={formData.consultationFee}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Available Days</label>
                                            <div className="days-checkboxes">
                                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                                    <label key={day} className="checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.availableDays.includes(day)}
                                                            onChange={() => handleDayToggle(day)}
                                                        />
                                                        {day}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="form-group time-range">
                                            <label>Available Hours</label>
                                            <div className="time-inputs">
                                                <input
                                                    type="time"
                                                    name="startTime"
                                                    value={formData.availableHours.start}
                                                    onChange={handleInputChange}
                                                />
                                                <span>to</span>
                                                <input
                                                    type="time"
                                                    name="endTime"
                                                    value={formData.availableHours.end}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-actions">
                                            <button type="submit" className="btn btn-primary">
                                                Update Settings
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-secondary"
                                                onClick={() => setShowSettingsInModal(false)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                            
                            <div className="modal-actions">
                                <button
                                    className="btn btn-info"
                                    onClick={() => {
                                        viewDoctorDashboard(selectedDoctorForModal.id);
                                        setShowDoctorModal(false);
                                    }}
                                >
                                    📈 Dashboard
                                </button>
                                <button
                                    className={`btn ${selectedDoctorForModal.isAvailable ? 'btn-warning' : 'btn-success'}`}
                                    onClick={() => {
                                        toggleAvailability(selectedDoctorForModal.id, !selectedDoctorForModal.isAvailable);
                                        setShowDoctorModal(false);
                                    }}
                                >
                                    {selectedDoctorForModal.isAvailable ? '⏸️ Unavailable' : '▶️ Available'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handleEditInModal(selectedDoctorForModal)}
                                >
                                    ⚙️ Settings
                                </button>
                                <button
                                    className="btn btn-danger"
                                    onClick={() => {
                                        handleDelete(selectedDoctorForModal.id);
                                        setShowDoctorModal(false);
                                    }}
                                >
                                    🗑️ Remove
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Doctors;