import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Layout/Sidebar';
import ReportModal from '../components/Shared/ReportModal';
import TemplateCustomizer from '../components/Shared/TemplateCustomizer';
import { useAuth } from '../context/AuthContext';
import {
    addPatientToQueue,
    updatePatient,
    getPatientHistory,
    getClinicStatus,
    getQueueAnalytics,
    getDoctors,
    createPatientReport
} from '../api/clinicApi';
import '../styles/Patients.scss';

const Patients = () => {
    const { currentUser } = useAuth();
    const [upcomingPatients, setUpcomingPatients] = useState([]);
    const [servedPatients, setServedPatients] = useState([]);
    const [cancelledPatients, setCancelledPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientHistory, setPatientHistory] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        doctorId: ''
    });
    const [doctors, setDoctors] = useState([]);
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [nextAvailableNumber, setNextAvailableNumber] = useState(0);
    const [clinicStatus, setClinicStatus] = useState({
        isOpen: false,
        operatingHours: { opening: '09:00', closing: '17:00' }
    });
    const [activeTab, setActiveTab] = useState('waiting');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('number');
    const [sortOrder, setSortOrder] = useState('asc');
    const [filterBy, setFilterBy] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [bulkSelection, setBulkSelection] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [selectedPatientForModal, setSelectedPatientForModal] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedPatientForReport, setSelectedPatientForReport] = useState(null);
    const [isCreatingReport, setIsCreatingReport] = useState(false);
    const [showTemplateCustomizer, setShowTemplateCustomizer] = useState(false);
    const [templateRefreshTrigger, setTemplateRefreshTrigger] = useState(0);

    const fetchClinicStatus = useCallback(async () => {
        try {
            const response = await getClinicStatus();
            setClinicStatus(response.data);
        } catch (err) {
            console.error('Error fetching clinic status:', err);
        }
    }, []);

    const fetchDoctors = useCallback(async () => {
        try {
            const response = await getDoctors();
            setDoctors(response.data || []);
        } catch (err) {
            console.error('Error fetching doctors:', err);
        }
    }, []);

    const fetchQueueAnalytics = useCallback(async () => {
        try {
            if (currentUser?.clinic?._id) {
                const { data } = await getQueueAnalytics();

                setUpcomingPatients(data.waiting || []);
                setServedPatients(data.served || []);
                setCancelledPatients(data.cancelled || []);

                // Calculate next available number
                const currentNumber = 0;
                const lastQueueNumber = data.waiting?.length > 0
                    ? Math.max(...data.waiting.map(p => p.number))
                    : currentNumber;

                setNextAvailableNumber(lastQueueNumber + 1);
                setLoading(false); // Set loading to false after data is fetched
            }
        } catch (error) {
            console.error('Error fetching queue analytics:', error);
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchQueueAnalytics();
        fetchClinicStatus();
        fetchDoctors();
    }, [fetchQueueAnalytics, fetchClinicStatus, fetchDoctors]);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const validateForm = () => {
        const errors = {};

        if (!formData.name.trim()) {
            errors.name = 'Name is required';
        }

        if (!formData.phone.trim()) {
            errors.phone = 'Phone number is required';
        } else if (!/^(\+92|92|0)?3\d{9}$/.test(formData.phone.replace(/\D/g, ''))) {
            errors.phone = 'Please enter a valid Pakistani phone number';
        }

        if (!formData.doctorId) {
            errors.doctorId = 'Please select a doctor';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleAddPatient = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setSubmitting(true);

        try {
            const patientResponse = await addPatientToQueue({
                name: formData.name,
                phone: formData.phone,
                doctorId: formData.doctorId
            });

            fetchQueueAnalytics();

            setFormData({
                name: '',
                phone: '',
                doctorId: ''
            });
            setShowAddForm(false);
            setSubmitting(false);

            const doctor = doctors.find(d => d._id === formData.doctorId);
            alert(`Patient added successfully!\nQueue number: ${patientResponse.data.queueNumber}\nDoctor: ${doctor?.name || 'Unknown'}`);

        } catch (error) {
            console.error('Error adding patient:', error);
            setSubmitting(false);
            alert(error.response?.data?.error || 'Failed to add patient. Please try again.');
        }
    };

    const handleEditPatient = (patient) => {
        setSelectedPatient(patient);
        setFormData({
            name: patient.name,
            phone: patient.phone,
        });
        setShowEditForm(true);
    };

    const handleUpdatePatient = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setSubmitting(true);

        try {
            await updatePatient(selectedPatient._id, {
                name: formData.name,
                phone: formData.phone,
            });

            fetchQueueAnalytics();
            setShowEditForm(false);
            setSubmitting(false);
            setSelectedPatient(null);

            alert('Patient updated successfully!');

        } catch (error) {
            console.error('Error updating patient:', error);
            setSubmitting(false);
            alert(error.response?.data?.error || 'Failed to update patient. Please try again.');
        }
    };

    const handleViewHistory = async (patient) => {
        setSelectedPatient(patient);
        try {
            console.log('Fetching history for patient:', patient);
            // Determine the best identifier to use for searching
            let patientIdentifier;
            
            // Priority: patient ID > phone > name
            if (patient.patient && patient.patient._id) {
                // For patients with actual Patient accounts
                patientIdentifier = patient.patient._id;
            } else if (patient._id && patient.patient) {
                // For queue entries with patient reference
                patientIdentifier = patient.patient;
            } else if (patient.phone && patient.phone !== 'N/A') {
                // For manual entries with phone numbers
                patientIdentifier = patient.phone;
            } else if (patient.name && patient.name !== 'Anonymous') {
                // Fallback to name search
                patientIdentifier = patient.name;
            } else {
                throw new Error('Unable to identify patient for history search');
            }
            
            console.log('Using patient identifier:', patientIdentifier);
            const history = await getPatientHistory(patientIdentifier);
            console.log('Patient history response:', history);
            setPatientHistory(history.data || []);
            setShowHistory(true);
        } catch (error) {
            console.error('Error fetching patient history:', error);
            alert(`Failed to load patient history: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleMarkAsServed = async (patient) => {
        try {
            // You'll need to create this API endpoint
            // await markPatientAsServed(patient._id);
            alert(`Patient ${patient.name} marked as served`);
            fetchQueueAnalytics();
        } catch (error) {
            console.error('Error marking as served:', error);
            alert('Failed to mark patient as served');
        }
    };

    const handleCancelPatient = async (patient) => {
        if (!window.confirm(`Are you sure you want to cancel ${patient.name}'s appointment?`)) {
            return;
        }
        
        try {
            // You'll need to create this API endpoint
            // await cancelPatient(patient._id);
            alert(`Patient ${patient.name} cancelled`);
            fetchQueueAnalytics();
        } catch (error) {
            console.error('Error cancelling patient:', error);
            alert('Failed to cancel patient');
        }
    };
    
    const handleBulkSelection = (patientId, isSelected) => {
        setBulkSelection(prev => {
            if (isSelected) {
                return [...prev, patientId];
            } else {
                return prev.filter(id => id !== patientId);
            }
        });
    };
    
    const handleSelectAll = (isSelected) => {
        if (isSelected) {
            setBulkSelection(getFilteredAndSortedPatients.map(p => p._id));
        } else {
            setBulkSelection([]);
        }
    };
    
    const handleBulkAction = async (action) => {
        if (bulkSelection.length === 0) {
            alert('Please select patients first');
            return;
        }
        
        const confirmMessage = `Are you sure you want to ${action} ${bulkSelection.length} selected patients?`;
        if (!window.confirm(confirmMessage)) {
            return;
        }
        
        try {
            // Implement bulk actions based on action type
            console.log(`Bulk ${action} for patients:`, bulkSelection);
            alert(`Bulk ${action} completed for ${bulkSelection.length} patients`);
            setBulkSelection([]);
            fetchQueueAnalytics();
        } catch (error) {
            console.error(`Error in bulk ${action}:`, error);
            alert(`Failed to ${action} selected patients`);
        }
    };
    
    const getEstimatedWaitTime = (queuePosition) => {
        const avgConsultationTime = 15; // minutes
        const estimatedMinutes = queuePosition * avgConsultationTime;
        
        if (estimatedMinutes < 60) {
            return `${estimatedMinutes} min`;
        } else {
            const hours = Math.floor(estimatedMinutes / 60);
            const minutes = estimatedMinutes % 60;
            return `${hours}h ${minutes}m`;
        }
    };
    
    const handlePatientClick = (patient) => {
        setSelectedPatientForModal(patient);
        setShowPatientModal(true);
    };

    const handleCreateReport = (patient) => {
        setSelectedPatientForReport(patient);
        setShowReportModal(true);
    };

    const handleReportSubmit = async (reportData) => {
        setIsCreatingReport(true);
        try {
            await createPatientReport(reportData);
            setShowReportModal(false);
            setSelectedPatientForReport(null);
            alert('Report created successfully! The patient will receive a PDF copy.');
        } catch (error) {
            console.error('Error creating report:', error);
            alert('Failed to create report. Please try again.');
        } finally {
            setIsCreatingReport(false);
        }
    };

    const getPatientsByStatus = () => {
        switch (activeTab) {
            case 'waiting':
                return upcomingPatients;
            case 'served':
                return servedPatients;
            case 'cancelled':
                return cancelledPatients;
            default:
                return upcomingPatients;
        }
    };

    const getFilteredAndSortedPatients = useMemo(() => {
        let patients = getPatientsByStatus();
        
        // Apply search filter
        if (searchTerm) {
            patients = patients.filter(patient => 
                patient.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                patient.phone?.includes(searchTerm) ||
                patient.number?.toString().includes(searchTerm)
            );
        }
        
        // Apply additional filters
        if (filterBy !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            patients = patients.filter(patient => {
                let patientDate;
                
                // Use appropriate date based on tab
                if (activeTab === 'served' && patient.servedAt) {
                    patientDate = new Date(patient.servedAt);
                } else if (activeTab === 'cancelled' && patient.cancelledAt) {
                    patientDate = new Date(patient.cancelledAt);
                } else {
                    patientDate = new Date(patient.bookedAt || patient.createdAt);
                }
                
                const patientDay = new Date(patientDate.getFullYear(), patientDate.getMonth(), patientDate.getDate());
                
                switch (filterBy) {
                    case 'recent':
                        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
                        return patientDate >= threeHoursAgo;
                    case 'today':
                        return patientDay.getTime() === today.getTime();
                    case 'thisWeek':
                        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        return patientDay >= weekAgo;
                    case 'thisMonth':
                        return patientDate.getMonth() === now.getMonth() && patientDate.getFullYear() === now.getFullYear();
                    default:
                        return true;
                }
            });
        }
        
        // Apply sorting
        patients.sort((a, b) => {
            let aValue, bValue;
            
            switch (sortBy) {
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'number':
                    aValue = a.number || 0;
                    bValue = b.number || 0;
                    break;
                case 'time':
                    aValue = new Date(a.bookedAt || a.createdAt).getTime();
                    bValue = new Date(b.bookedAt || b.createdAt).getTime();
                    break;
                default:
                    return 0;
            }
            
            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return patients;
    }, [getPatientsByStatus(), searchTerm, filterBy, sortBy, sortOrder]);

    const getStatusCount = (status) => {
        switch (status) {
            case 'waiting':
                return upcomingPatients.length;
            case 'served':
                return servedPatients.length;
            case 'cancelled':
                return cancelledPatients.length;
            default:
                return 0;
        }
    };

    if (loading) {
        return (
            <div className="patients-container">
                <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
                <div className="patients-content">
                    <div className="loading">Loading patients...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="patients-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="patients-content">

                <div className="patients-header">
                    <button className="sidebar-toggle" onClick={toggleSidebar}>
                        ☰
                    </button>
                    <h1>Patient Management</h1>
                    <div className="header-actions">
                        <div className="clinic-status">
                            <span className={`status-indicator ${clinicStatus.isOpen ? 'open' : 'closed'}`}>
                                {clinicStatus.isOpen ? '🟢 Open' : '🔴 Closed'}
                            </span>
                            <span className="operating-hours">
                                {clinicStatus.operatingHours?.opening} - {clinicStatus.operatingHours?.closing}
                            </span>
                        </div>
                        <button
                            className="customize-templates-btn"
                            onClick={() => setShowTemplateCustomizer(true)}
                            title="Customize report templates"
                        >
                            ⚙️ Templates
                        </button>
                        <button
                            className="refresh-btn"
                            onClick={fetchQueueAnalytics}
                            title="Refresh data"
                        >
                            ↻ Refresh
                        </button>
                        <button
                            className={`add-patient-btn ${!clinicStatus.isOpen ? 'disabled' : ''}`}
                            onClick={() => clinicStatus.isOpen && setShowAddForm(true)}
                            disabled={!clinicStatus.isOpen}
                        >
                            {clinicStatus.isOpen ? '+ Add Patient' : 'Clinic Closed'}
                        </button>
                    </div>
                </div>
                
                {/* Quick Stats */}
                <div className="quick-stats">
                    <div className="stat-card waiting">
                        <div className="stat-number">{getStatusCount('waiting')}</div>
                        <div className="stat-label">Waiting</div>
                        <div className="stat-detail">
                            {getStatusCount('waiting') > 0 && (
                                <span>Est. wait: {getEstimatedWaitTime(getStatusCount('waiting'))}</span>
                            )}
                        </div>
                    </div>
                    <div className="stat-card served">
                        <div className="stat-number">{getStatusCount('served')}</div>
                        <div className="stat-label">Served Today</div>
                    </div>
                    <div className="stat-card cancelled">
                        <div className="stat-number">{getStatusCount('cancelled')}</div>
                        <div className="stat-label">Cancelled</div>
                    </div>
                    <div className="stat-card total">
                        <div className="stat-number">{nextAvailableNumber - 1}</div>
                        <div className="stat-label">Total Today</div>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="status-tabs">
                    <button
                        className={`tab ${activeTab === 'waiting' ? 'active' : ''}`}
                        onClick={() => setActiveTab('waiting')}
                    >
                        Waiting ({getStatusCount('waiting')})
                    </button>
                    <button
                        className={`tab ${activeTab === 'served' ? 'active' : ''}`}
                        onClick={() => setActiveTab('served')}
                    >
                        Served ({getStatusCount('served')})
                    </button>
                    <button
                        className={`tab ${activeTab === 'cancelled' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cancelled')}
                    >
                        Cancelled ({getStatusCount('cancelled')})
                    </button>
                </div>

                {/* Add Patient Modal */}
                {showAddForm && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2>Add Patient to Queue</h2>
                                <button
                                    className="close-modal"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <form onSubmit={handleAddPatient} className="patient-form">
                                <div className="form-group">
                                    <label htmlFor="name">Full Name *</label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className={formErrors.name ? 'error' : ''}
                                        placeholder="Enter patient's full name"
                                    />
                                    {formErrors.name && (
                                        <span className="error-text">{formErrors.name}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="phone">Phone Number *</label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className={formErrors.phone ? 'error' : ''}
                                        placeholder="e.g., 03001234567"
                                    />
                                    {formErrors.phone && (
                                        <span className="error-text">{formErrors.phone}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="doctorId">Select Doctor *</label>
                                    <select
                                        id="doctorId"
                                        name="doctorId"
                                        value={formData.doctorId}
                                        onChange={handleInputChange}
                                        className={formErrors.doctorId ? 'error' : ''}
                                    >
                                        <option value="">Choose a doctor...</option>
                                        {doctors.filter(doctor => doctor.isActive && doctor.isAvailable !== false).map(doctor => (
                                            <option key={doctor._id} value={doctor._id}>
                                                {doctor.name} - {doctor.specialties?.[0] || 'General Practitioner'}
                                            </option>
                                        ))}
                                    </select>
                                    {formErrors.doctorId && (
                                        <span className="error-text">{formErrors.doctorId}</span>
                                    )}
                                </div>

                                <div className="queue-info">
                                    <div className="info-item">
                                        <span className="label">Next Available Number:</span>
                                        <span className="value badge">{nextAvailableNumber}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="label">Total Waiting:</span>
                                        <span className="value">{getStatusCount('waiting')}</span>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setShowAddForm(false)}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Adding...' : `Add to Queue (#${nextAvailableNumber})`}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Patient Modal */}
                {showEditForm && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2>Edit Patient</h2>
                                <button
                                    className="close-modal"
                                    onClick={() => setShowEditForm(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <form onSubmit={handleUpdatePatient} className="patient-form">
                                <div className="form-group">
                                    <label htmlFor="edit-name">Full Name *</label>
                                    <input
                                        type="text"
                                        id="edit-name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className={formErrors.name ? 'error' : ''}
                                        placeholder="Enter patient's full name"
                                    />
                                    {formErrors.name && (
                                        <span className="error-text">{formErrors.name}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="edit-phone">Phone Number *</label>
                                    <input
                                        type="tel"
                                        id="edit-phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className={formErrors.phone ? 'error' : ''}
                                        placeholder="e.g., 03001234567"
                                    />
                                    {formErrors.phone && (
                                        <span className="error-text">{formErrors.phone}</span>
                                    )}
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setShowEditForm(false)}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Updating...' : 'Update Patient'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Patient Detail Modal */}
                {showPatientModal && selectedPatientForModal && (
                    <div className="modal-overlay">
                        <div className="modal-content patient-detail-modal">
                            <div className="modal-header">
                                <h2>Patient Details</h2>
                                <button
                                    className="close-modal"
                                    onClick={() => setShowPatientModal(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="patient-detail-content">
                                <div className="detail-section">
                                    <h3>Basic Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="label">Name:</span>
                                            <span className="value">{selectedPatientForModal.name || 'Anonymous'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Phone:</span>
                                            <span className="value">{selectedPatientForModal.phone || 'N/A'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Queue Number:</span>
                                            <span className="value queue-badge">#{selectedPatientForModal.number}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Status:</span>
                                            <span className={`status-badge ${selectedPatientForModal.status}`}>
                                                {selectedPatientForModal.status}
                                            </span>
                                        </div>
                                        {selectedPatientForModal.doctor && (
                                            <div className="detail-item">
                                                <span className="label">Doctor:</span>
                                                <span className="value">Dr. {selectedPatientForModal.doctor.name}</span>
                                            </div>
                                        )}
                                        {selectedPatientForModal.isManualEntry && (
                                            <div className="detail-item">
                                                <span className="label">Entry Type:</span>
                                                <span className="value manual-entry">Manual Entry</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="detail-section">
                                    <h3>Timeline</h3>
                                    <div className="timeline">
                                        <div className="timeline-item">
                                            <span className="timeline-label">Added to Queue:</span>
                                            <span className="timeline-value">
                                                {selectedPatientForModal.bookedAt ? 
                                                    new Date(selectedPatientForModal.bookedAt).toLocaleString() : 
                                                    (selectedPatientForModal.createdAt ? 
                                                        new Date(selectedPatientForModal.createdAt).toLocaleString() : 
                                                        'Unknown'
                                                    )
                                                }
                                            </span>
                                        </div>
                                        {selectedPatientForModal.servedAt && (
                                            <div className="timeline-item served">
                                                <span className="timeline-label">Served:</span>
                                                <span className="timeline-value">
                                                    {new Date(selectedPatientForModal.servedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        {selectedPatientForModal.cancelledAt && (
                                            <div className="timeline-item cancelled">
                                                <span className="timeline-label">Cancelled:</span>
                                                <span className="timeline-value">
                                                    {new Date(selectedPatientForModal.cancelledAt).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="modal-actions">
                                    <button
                                        className="btn-primary"
                                        onClick={() => handleViewHistory(selectedPatientForModal)}
                                    >
                                        View Full History
                                    </button>
                                    <button
                                        className="btn-report"
                                        onClick={() => {
                                            handleCreateReport(selectedPatientForModal);
                                            setShowPatientModal(false);
                                        }}
                                    >
                                        📄 Add Report
                                    </button>
                                    {selectedPatientForModal.status === 'waiting' && (
                                        <>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => {
                                                    handleEditPatient(selectedPatientForModal);
                                                    setShowPatientModal(false);
                                                }}
                                            >
                                                Edit Patient
                                            </button>
                                            <button
                                                className="btn-success"
                                                onClick={() => {
                                                    handleMarkAsServed(selectedPatientForModal);
                                                    setShowPatientModal(false);
                                                }}
                                            >
                                                Mark as Served
                                            </button>
                                            <button
                                                className="btn-danger"
                                                onClick={() => {
                                                    handleCancelPatient(selectedPatientForModal);
                                                    setShowPatientModal(false);
                                                }}
                                            >
                                                Cancel Appointment
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* History Modal */}
                {showHistory && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2>Patient History - {selectedPatient?.name}</h2>
                                <button
                                    className="close-modal"
                                    onClick={() => setShowHistory(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="history-content">
                                {patientHistory.length > 0 ? (
                                    <div className="history-list">
                                        {patientHistory.map((visit, index) => (
                                            <div key={visit._id || index} className="history-item">
                                                <div className="visit-info">
                                                    <span className="visit-number">#{visit.number}</span>
                                                    <span className={`status-badge ${visit.status}`}>
                                                        {visit.status}
                                                    </span>
                                                    {visit.doctor && (
                                                        <span className="visit-doctor">
                                                            Dr. {visit.doctor.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="visit-details">
                                                    <div className="visit-date-time">
                                                        <span className="visit-date">
                                                            {(visit.servedAt || visit.cancelledAt || visit.bookedAt) ? 
                                                                new Date(visit.servedAt || visit.cancelledAt || visit.bookedAt).toLocaleDateString() : 
                                                                'Unknown Date'
                                                            }
                                                        </span>
                                                        <span className="visit-time">
                                                            {(visit.servedAt || visit.cancelledAt || visit.bookedAt) ? 
                                                                new Date(visit.servedAt || visit.cancelledAt || visit.bookedAt).toLocaleTimeString() : 
                                                                'Unknown Time'
                                                            }
                                                        </span>
                                                    </div>
                                                    {visit.patientName && (
                                                        <div className="visit-patient">
                                                            Patient: {visit.patientName}
                                                        </div>
                                                    )}
                                                    {visit.manualEntry?.phone && (
                                                        <div className="visit-phone">
                                                            Phone: {visit.manualEntry.phone}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="no-history">
                                        <p>No previous visits found for this patient at this clinic.</p>
                                        <p className="no-history-note">History shows completed (served/cancelled) appointments only.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="patients-grid">
                    <div className="patients-card">
                        <div className="card-header">
                            <h2>
                                {activeTab === 'waiting' && 'Patients in Queue'}
                                {activeTab === 'served' && 'Served Patients'}
                                {activeTab === 'cancelled' && 'Cancelled Patients'}
                                ({getFilteredAndSortedPatients.length})
                            </h2>
                            <div className="header-controls">
                                <div className="search-box">
                                    <input
                                        type="text"
                                        placeholder="Search by name, phone, or number..."
                                        className="search-input"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <button className="search-clear" onClick={() => setSearchTerm('')}>
                                        ×
                                    </button>
                                </div>
                                <button 
                                    className="filter-toggle"
                                    onClick={() => setShowFilters(!showFilters)}
                                    title="Toggle filters"
                                >
                                    📊 Filters
                                </button>
                                {bulkSelection.length > 0 && (
                                    <button 
                                        className="bulk-actions-toggle"
                                        onClick={() => setShowBulkActions(!showBulkActions)}
                                    >
                                        Actions ({bulkSelection.length})
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Advanced Filters */}
                        {showFilters && (
                            <div className="filters-panel">
                                <div className="filter-group">
                                    <label>Sort by:</label>
                                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                        <option value="number">Queue Number</option>
                                        <option value="name">Name</option>
                                        <option value="time">Time Added</option>
                                    </select>
                                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                                        <option value="asc">Ascending</option>
                                        <option value="desc">Descending</option>
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label>Filter by:</label>
                                    <select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
                                        <option value="all">All Time</option>
                                        <option value="recent">Recent (Last 3 hours)</option>
                                        <option value="today">Today</option>
                                        <option value="thisWeek">This Week</option>
                                        <option value="thisMonth">This Month</option>
                                    </select>
                                </div>
                            </div>
                        )}
                        
                        {/* Bulk Actions */}
                        {showBulkActions && bulkSelection.length > 0 && (
                            <div className="bulk-actions-panel">
                                <div className="bulk-actions">
                                    <button 
                                        className="bulk-btn bulk-serve"
                                        onClick={() => handleBulkAction('serve')}
                                    >
                                        Mark as Served
                                    </button>
                                    <button 
                                        className="bulk-btn bulk-cancel"
                                        onClick={() => handleBulkAction('cancel')}
                                    >
                                        Cancel Selected
                                    </button>
                                    <button 
                                        className="bulk-btn bulk-clear"
                                        onClick={() => setBulkSelection([])}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Bulk Selection Header */}
                        {activeTab === 'waiting' && getFilteredAndSortedPatients.length > 0 && (
                            <div className="bulk-selection-header">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        checked={bulkSelection.length === getFilteredAndSortedPatients.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                    <span className="checkmark"></span>
                                    Select All ({getFilteredAndSortedPatients.length})
                                </label>
                            </div>
                        )}

                        <div className="patients-list-compact">
                            {getFilteredAndSortedPatients.map((patient, index) => (
                                <div 
                                    key={patient._id} 
                                    className={`patient-row ${bulkSelection.includes(patient._id) ? 'selected' : ''}`}
                                    onClick={() => handlePatientClick(patient)}
                                >
                                    {activeTab === 'waiting' && (
                                        <div className="patient-checkbox" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={bulkSelection.includes(patient._id)}
                                                onChange={(e) => handleBulkSelection(patient._id, e.target.checked)}
                                            />
                                        </div>
                                    )}
                                    <div className="patient-basic-info">
                                        <div className="patient-name">{patient.name || 'Anonymous'}</div>
                                        <div className="patient-phone">{patient.phone || 'N/A'}</div>
                                        {patient.doctor && (
                                            <div className="patient-doctor">Dr. {patient.doctor.name}</div>
                                        )}
                                    </div>
                                    <div className="patient-queue">
                                        {patient.number && (
                                            <span className="queue-number">#{patient.number}</span>
                                        )}
                                    </div>
                                    <div className="patient-status">
                                        <span className={`status-badge ${patient.status}`}>
                                            {patient.status}
                                        </span>
                                    </div>
                                    <div className="patient-time">
                                        {activeTab === 'waiting' && (
                                            <span className="wait-time">{getEstimatedWaitTime(index + 1)}</span>
                                        )}
                                        {patient.servedAt && (
                                            <span className="served-time">
                                                {new Date(patient.servedAt).toLocaleTimeString()}
                                            </span>
                                        )}
                                        {patient.cancelledAt && (
                                            <span className="cancelled-time">
                                                {new Date(patient.cancelledAt).toLocaleTimeString()}
                                            </span>
                                        )}
                                        {activeTab === 'waiting' && patient.bookedAt && (
                                            <span className="booked-time">
                                                {new Date(patient.bookedAt).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="patient-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="btn-report btn-xs"
                                            onClick={() => handleCreateReport(patient)}
                                            title="Add report"
                                        >
                                            📄
                                        </button>
                                        {activeTab === 'waiting' && (
                                            <>
                                                <button
                                                    className="btn-success btn-xs"
                                                    onClick={() => handleMarkAsServed(patient)}
                                                    title="Mark as served"
                                                >
                                                    ✅
                                                </button>
                                                <button
                                                    className="btn-danger btn-xs"
                                                    onClick={() => handleCancelPatient(patient)}
                                                    title="Cancel appointment"
                                                >
                                                    ❌
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {getFilteredAndSortedPatients.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    {activeTab === 'waiting' && '🚪'}
                                    {activeTab === 'served' && '✅'}
                                    {activeTab === 'cancelled' && '❌'}
                                </div>
                                <h3>
                                    {activeTab === 'waiting' && 'No patients in queue'}
                                    {activeTab === 'served' && 'No patients served yet'}
                                    {activeTab === 'cancelled' && 'No cancelled patients'}
                                </h3>
                                <p>
                                    {activeTab === 'waiting' && searchTerm 
                                        ? 'No patients match your search criteria' 
                                        : 'Queue is empty. Add patients to get started.'}
                                    {activeTab === 'served' && 'Served patients will appear here'}
                                    {activeTab === 'cancelled' && 'Cancelled appointments will appear here'}
                                </p>
                                {activeTab === 'waiting' && !searchTerm && clinicStatus.isOpen && (
                                    <button 
                                        className="btn-primary"
                                        onClick={() => setShowAddForm(true)}
                                    >
                                        Add First Patient
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Template Customizer Modal */}
                <TemplateCustomizer
                    isOpen={showTemplateCustomizer}
                    onClose={() => setShowTemplateCustomizer(false)}
                    onSave={() => {
                        setTemplateRefreshTrigger(prev => prev + 1);
                        alert('Templates saved successfully!');
                    }}
                />

                {/* Report Modal */}
                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => {
                        setShowReportModal(false);
                        setSelectedPatientForReport(null);
                    }}
                    patient={selectedPatientForReport}
                    onSubmit={handleReportSubmit}
                    isSubmitting={isCreatingReport}
                    refreshTrigger={templateRefreshTrigger}
                />
            </div>
        </div>
    );
};

export default Patients;