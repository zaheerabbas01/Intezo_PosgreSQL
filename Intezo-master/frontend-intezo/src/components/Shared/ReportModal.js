import React, { useState, useEffect } from 'react';
import './ReportModal.scss';
import { makeAuthenticatedRequest, handleApiError, isAuthenticated } from '../../utils/authUtils';

const ReportModal = ({ isOpen, onClose, patient, onSubmit, isSubmitting, refreshTrigger }) => {
  const [reportType, setReportType] = useState('medical'); // 'medical' or 'lab_test'
  const [formData, setFormData] = useState({
    title: '',
    diagnosis: '',
    symptoms: '',
    treatment: '',
    medications: [{ name: '', dosage: '', frequency: '', duration: '' }],
    recommendations: '',
    notes: '',
    followUpDate: '',
    labTests: [{ testName: '', result: '', normalRange: '', unit: '', status: 'normal' }]
  });

  const [errors, setErrors] = useState({});
  const [options, setOptions] = useState({
    titles: [
      'General Consultation',
      'Follow-up Visit',
      'Routine Check-up',
      'Emergency Visit',
      'Specialist Consultation',
      'Lab Results Review',
      'Vaccination Record',
      'Physical Examination',
      'Diagnostic Report',
      'Treatment Plan'
    ],
    symptoms: [
      'Fever',
      'Headache',
      'Cough',
      'Sore throat',
      'Fatigue',
      'Nausea',
      'Vomiting',
      'Diarrhea',
      'Abdominal pain',
      'Chest pain',
      'Shortness of breath',
      'Dizziness',
      'Joint pain',
      'Muscle pain',
      'Skin rash',
      'Back pain',
      'Loss of appetite',
      'Sleep problems',
      'Anxiety',
      'Depression'
    ],
    diagnoses: [
      'Normal examination',
      'Upper respiratory infection',
      'Hypertension',
      'Diabetes mellitus',
      'Gastroenteritis',
      'Migraine',
      'Allergic reaction',
      'Bronchitis',
      'Urinary tract infection',
      'Viral infection',
      'Bacterial infection',
      'Anxiety disorder',
      'Depression',
      'Arthritis',
      'Asthma',
      'Dermatitis',
      'Gastritis',
      'Sinusitis',
      'Pneumonia',
      'Influenza'
    ],
    treatments: [
      'Rest and hydration',
      'Medication as prescribed',
      'Follow-up in 1 week',
      'Follow-up in 2 weeks',
      'Follow-up in 1 month',
      'Physical therapy',
      'Dietary modifications',
      'Lifestyle changes',
      'Regular exercise',
      'Stress management',
      'Blood pressure monitoring',
      'Blood sugar monitoring',
      'Wound care',
      'Hot/cold compress',
      'Avoid allergens',
      'Increase fluid intake',
      'Bed rest',
      'Gradual activity increase',
      'Specialist referral',
      'Laboratory tests'
    ],
    medications: [
      { name: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours' },
      { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 8 hours' },
      { name: 'Amoxicillin', dosage: '500mg', frequency: 'Every 8 hours' },
      { name: 'Omeprazole', dosage: '20mg', frequency: 'Once daily' },
      { name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily' },
      { name: 'Salbutamol', dosage: '100mcg', frequency: 'As needed' },
      { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
      { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily' },
      { name: 'Aspirin', dosage: '75mg', frequency: 'Once daily' },
      { name: 'Prednisolone', dosage: '5mg', frequency: 'Once daily' }
    ],
    recommendations: [
      'Maintain adequate rest',
      'Stay well hydrated',
      'Follow prescribed medication schedule',
      'Return if symptoms worsen',
      'Avoid strenuous activities',
      'Maintain healthy diet',
      'Regular exercise as tolerated',
      'Monitor blood pressure regularly',
      'Monitor blood sugar levels',
      'Avoid smoking and alcohol',
      'Practice stress management',
      'Get adequate sleep',
      'Follow up as scheduled',
      'Complete full course of antibiotics',
      'Avoid known allergens'
    ]
  });

  useEffect(() => {
    if (isOpen) {
      if (!isAuthenticated()) {
        console.warn('User not authenticated, using default options');
        return;
      }
      fetchReportOptions();
    }
  }, [isOpen, refreshTrigger]);

  const fetchReportOptions = async () => {
    try {
      if (!isAuthenticated()) {
        console.warn('User not authenticated, using default options');
        return; // Keep existing default options
      }

      const data = await makeAuthenticatedRequest('/api/reports/options');
      
      if (data.success && data.options) {
        setOptions(data.options);
      }
    } catch (error) {
      const errorMessage = handleApiError(error, error.response);
      console.warn('Error fetching report options:', errorMessage);
      // Keep using the default options already set in state
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleMedicationChange = (index, field, value) => {
    const updatedMedications = [...formData.medications];
    updatedMedications[index][field] = value;
    setFormData(prev => ({
      ...prev,
      medications: updatedMedications
    }));
  };

  const addMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, { name: '', dosage: '', frequency: '', duration: '' }]
    }));
  };

  const removeMedication = (index) => {
    if (formData.medications.length > 1) {
      const updatedMedications = formData.medications.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        medications: updatedMedications
      }));
    }
  };

  const handleLabTestChange = (index, field, value) => {
    const updatedLabTests = [...formData.labTests];
    updatedLabTests[index][field] = value;
    setFormData(prev => ({
      ...prev,
      labTests: updatedLabTests
    }));
  };

  const addLabTest = () => {
    setFormData(prev => ({
      ...prev,
      labTests: [...prev.labTests, { testName: '', result: '', normalRange: '', unit: '', status: 'normal' }]
    }));
  };

  const removeLabTest = (index) => {
    if (formData.labTests.length > 1) {
      const updatedLabTests = formData.labTests.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        labTests: updatedLabTests
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Report title is required';
    }

    if (!formData.diagnosis.trim()) {
      newErrors.diagnosis = 'Diagnosis is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Filter out empty medications
    const filteredMedications = formData.medications.filter(med => med.name.trim());

    const reportData = {
      ...formData,
      reportType,
      medications: filteredMedications,
      patientId: patient.patient?.id || patient.patient?._id || patient._id || patient.id,
      patientName: patient.patientName || patient.name || null,
      doctorId: patient.doctor?.id || patient.doctor?._id || patient.doctorId
    };
    
    console.log('Report data being sent:', reportData);
    console.log('Patient object:', patient);

    onSubmit(reportData);
  };

  const resetForm = () => {
    setReportType('medical');
    setFormData({
      title: '',
      diagnosis: '',
      symptoms: '',
      treatment: '',
      medications: [{ name: '', dosage: '', frequency: '', duration: '' }],
      recommendations: '',
      notes: '',
      followUpDate: '',
      labTests: [{ testName: '', result: '', normalRange: '', unit: '', status: 'normal' }]
    });
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay">
      <div className="report-modal">
        <div className="report-modal-header">
          <div className="header-content">
            <h2>{reportType === 'medical' ? 'Create Medical Report' : 'Create Lab Test Report'}</h2>
            <div className="report-type-toggle">
              <button 
                type="button"
                className={`toggle-btn ${reportType === 'medical' ? 'active' : ''}`}
                onClick={() => setReportType('medical')}
              >
                Medical Report
              </button>
              <button 
                type="button"
                className={`toggle-btn ${reportType === 'lab_test' ? 'active' : ''}`}
                onClick={() => setReportType('lab_test')}
              >
                Test Report
              </button>
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="patient-info">
          <h3>Patient Information</h3>
          <div className="patient-details">
            <span><strong>Name:</strong> {patient.name || 'Anonymous'}</span>
            <span><strong>Phone:</strong> {patient.phone || 'N/A'}</span>
            {patient.number && <span><strong>Queue #:</strong> {patient.number}</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="title">Report Title *</label>
              <select
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={errors.title ? 'error' : ''}
              >
                <option value="">Select report title...</option>
                {reportType === 'medical' ? (
                  options.titles.map((title, index) => (
                    <option key={index} value={title}>{title}</option>
                  ))
                ) : (
                  (options.labTestTitles || ['Blood Test Report', 'Urine Test Report', 'X-Ray Report', 'CT Scan Report', 'MRI Report', 'ECG Report', 'Ultrasound Report']).map((title, index) => (
                    <option key={index} value={title}>{title}</option>
                  ))
                )}
              </select>
              {errors.title && <span className="error-text">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="diagnosis">{reportType === 'medical' ? 'Diagnosis' : 'Test Summary'} *</label>
              <select
                id="diagnosis"
                name="diagnosis"
                value={formData.diagnosis}
                onChange={handleInputChange}
                className={errors.diagnosis ? 'error' : ''}
              >
                <option value="">Select {reportType === 'medical' ? 'diagnosis' : 'test summary'}...</option>
                {reportType === 'medical' ? (
                  options.diagnoses.map((diagnosis, index) => (
                    <option key={index} value={diagnosis}>{diagnosis}</option>
                  ))
                ) : (
                  (options.labTestSummaries || ['Normal results', 'Abnormal results - requires follow-up', 'Critical values detected', 'Inconclusive results', 'Test completed successfully']).map((summary, index) => (
                    <option key={index} value={summary}>{summary}</option>
                  ))
                )}
              </select>
              {errors.diagnosis && <span className="error-text">{errors.diagnosis}</span>}
            </div>
          </div>

          {reportType === 'medical' && (
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="symptoms">Symptoms</label>
                <select
                  id="symptoms"
                  name="symptoms"
                  value={formData.symptoms}
                  onChange={handleInputChange}
                >
                  <option value="">Select symptoms...</option>
                  {options.symptoms.map((symptom, index) => (
                    <option key={index} value={symptom}>{symptom}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="treatment">Treatment</label>
                <select
                  id="treatment"
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleInputChange}
                >
                  <option value="">Select treatment...</option>
                  {options.treatments.map((treatment, index) => (
                    <option key={index} value={treatment}>{treatment}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {reportType === 'medical' && (
            <div className="form-section">
              <div className="medications-section">
                <div className="section-header">
                  <label>Medications</label>
                  <button type="button" onClick={addMedication} className="add-medication-btn">
                    + Add Medication
                  </button>
                </div>
                
                {formData.medications.map((medication, index) => (
                  <div key={index} className="medication-item">
                    <div className="medication-header">
                      <span>Medication {index + 1}</span>
                      {formData.medications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMedication(index)}
                          className="remove-medication-btn"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="medication-fields">
                      <select
                        value={medication.name}
                        onChange={(e) => {
                          const selectedMed = options.medications.find(med => med.name === e.target.value);
                          if (selectedMed) {
                            handleMedicationChange(index, 'name', selectedMed.name);
                            handleMedicationChange(index, 'dosage', selectedMed.dosage);
                            handleMedicationChange(index, 'frequency', selectedMed.frequency);
                          } else {
                            handleMedicationChange(index, 'name', e.target.value);
                          }
                        }}
                      >
                        <option value="">Select medication...</option>
                        {options.medications.map((med, medIndex) => (
                          <option key={medIndex} value={med.name}>{med.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Dosage (e.g., 500mg)"
                        value={medication.dosage}
                        onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Frequency (e.g., Twice daily)"
                        value={medication.frequency}
                        onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Duration (e.g., 7 days)"
                        value={medication.duration}
                        onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportType === 'lab_test' && (
            <div className="form-section">
              <div className="lab-tests-section">
                <div className="section-header">
                  <label>Lab Test Results</label>
                  <button type="button" onClick={addLabTest} className="add-test-btn">
                    + Add Test
                  </button>
                </div>
                
                {formData.labTests.map((test, index) => (
                  <div key={index} className="lab-test-item">
                    <div className="test-header">
                      <span>Test {index + 1}</span>
                      {formData.labTests.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLabTest(index)}
                          className="remove-test-btn"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="test-fields">
                      <select
                        value={test.testName}
                        onChange={(e) => handleLabTestChange(index, 'testName', e.target.value)}
                      >
                        <option value="">Select test name...</option>
                        {(options.labTestNames || ['Hemoglobin', 'Blood Sugar', 'Cholesterol']).map((testName, testIndex) => (
                          <option key={testIndex} value={testName}>{testName}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Result (e.g., 12.5)"
                        value={test.result}
                        onChange={(e) => handleLabTestChange(index, 'result', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Normal Range (e.g., 12-16)"
                        value={test.normalRange}
                        onChange={(e) => handleLabTestChange(index, 'normalRange', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Unit (e.g., g/dL)"
                        value={test.unit}
                        onChange={(e) => handleLabTestChange(index, 'unit', e.target.value)}
                      />
                      <select
                        value={test.status}
                        onChange={(e) => handleLabTestChange(index, 'status', e.target.value)}
                      >
                        <option value="normal">Normal</option>
                        <option value="abnormal">Abnormal</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-section">
            <div className="form-group">
              <label htmlFor="recommendations">Recommendations</label>
              <select
                id="recommendations"
                name="recommendations"
                value={formData.recommendations}
                onChange={handleInputChange}
              >
                <option value="">Select recommendations...</option>
                {options.recommendations.map((recommendation, index) => (
                  <option key={index} value={recommendation}>{recommendation}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="followUpDate">Follow-up Date</label>
              <input
                type="date"
                id="followUpDate"
                name="followUpDate"
                value={formData.followUpDate}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label htmlFor="notes">Additional Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any additional notes..."
                rows="3"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleClose} className="cancel-btn" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Report...' : `Create ${reportType === 'medical' ? 'Medical' : 'Lab Test'} Report`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;