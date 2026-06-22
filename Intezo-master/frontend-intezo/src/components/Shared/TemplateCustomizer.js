import React, { useState, useEffect } from 'react';
import './TemplateCustomizer.scss';
import { makeAuthenticatedRequest, handleApiError, isAuthenticated } from '../../utils/authUtils';

const TemplateCustomizer = ({ isOpen, onClose, onSave }) => {
  const [templates, setTemplates] = useState({
    titles: [],
    symptoms: [],
    diagnoses: [],
    treatments: [],
    medications: [],
    recommendations: [],
    labTestTitles: [],
    labTestNames: [],
    labTestSummaries: []
  });

  const [newItem, setNewItem] = useState('');
  const [activeSection, setActiveSection] = useState('titles');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!isAuthenticated()) {
        alert('Please log in to customize templates.');
        onClose();
        return;
      }
      loadCustomTemplates();
    }
  }, [isOpen]);

  const loadCustomTemplates = async () => {
    try {
      if (!isAuthenticated()) {
        console.warn('User not authenticated, using default templates');
        setTemplates(getDefaultTemplates());
        return;
      }

      const data = await makeAuthenticatedRequest('/api/reports/custom-templates');
      
      if (data.success && data.templates) {
        setTemplates(data.templates);
      } else {
        // Initialize with default templates if no custom templates exist
        setTemplates(getDefaultTemplates());
      }
    } catch (error) {
      const errorMessage = handleApiError(error, error.response);
      console.warn('Error loading templates:', errorMessage);
      // Use default templates as fallback
      setTemplates(getDefaultTemplates());
    }
  };

  const getDefaultTemplates = () => ({
    titles: [
      'General Consultation',
      'Follow-up Visit',
      'Routine Check-up',
      'Emergency Visit',
      'Specialist Consultation'
    ],
    symptoms: [
      'Fever',
      'Headache',
      'Cough',
      'Sore throat',
      'Fatigue'
    ],
    diagnoses: [
      'Normal examination',
      'Upper respiratory infection',
      'Hypertension',
      'Diabetes mellitus',
      'Gastroenteritis'
    ],
    treatments: [
      'Rest and hydration',
      'Medication as prescribed',
      'Follow-up in 1 week',
      'Physical therapy',
      'Dietary modifications'
    ],
    medications: [
      'Paracetamol',
      'Ibuprofen',
      'Amoxicillin',
      'Omeprazole',
      'Cetirizine'
    ],
    recommendations: [
      'Maintain adequate rest',
      'Stay well hydrated',
      'Follow prescribed medication schedule',
      'Return if symptoms worsen',
      'Maintain healthy diet'
    ],
    labTestTitles: [
      'Blood Test Report',
      'Urine Test Report',
      'X-Ray Report',
      'CT Scan Report',
      'MRI Report',
      'ECG Report',
      'Ultrasound Report'
    ],
    labTestNames: [
      'Hemoglobin',
      'Blood Sugar',
      'Cholesterol',
      'Blood Pressure',
      'White Blood Cells',
      'Red Blood Cells',
      'Platelets',
      'Creatinine',
      'Urea',
      'Liver Enzymes'
    ],
    labTestSummaries: [
      'Normal results',
      'Abnormal results - requires follow-up',
      'Critical values detected',
      'Inconclusive results',
      'Test completed successfully'
    ]
  });

  const addItem = () => {
    if (!newItem.trim()) return;
    
    setTemplates(prev => ({
      ...prev,
      [activeSection]: [...prev[activeSection], newItem.trim()]
    }));
    setNewItem('');
  };

  const removeItem = (section, index) => {
    setTemplates(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!isAuthenticated()) {
        alert('Please log in to save templates.');
        return;
      }


      const data = await makeAuthenticatedRequest('/api/reports/custom-templates', {
        method: 'POST',
        body: JSON.stringify({ templates })
      });
      
      if (data.success) {
        alert('Templates saved successfully!');
        onSave();
        onClose();
      } else {
        alert('Failed to save templates: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      const errorMessage = handleApiError(error, error.response);
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const sections = [
    { key: 'titles', label: 'Medical Report Titles', category: 'medical' },
    { key: 'symptoms', label: 'Symptoms', category: 'medical' },
    { key: 'diagnoses', label: 'Diagnoses', category: 'medical' },
    { key: 'treatments', label: 'Treatments', category: 'medical' },
    { key: 'medications', label: 'Medications', category: 'medical' },
    { key: 'recommendations', label: 'Recommendations', category: 'medical' },
    { key: 'labTestTitles', label: 'Lab Test Titles', category: 'lab' },
    { key: 'labTestNames', label: 'Test Names', category: 'lab' },
    { key: 'labTestSummaries', label: 'Test Summaries', category: 'lab' }
  ];

  return (
    <div className="template-customizer-overlay">
      <div className="template-customizer">
        <div className="customizer-header">
          <h2>Customize Report Templates</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="customizer-content">
          <div className="sections-nav">
            <div className="category-group">
              <h4>Medical Reports</h4>
              {sections.filter(s => s.category === 'medical').map(section => (
                <button
                  key={section.key}
                  className={`section-btn ${activeSection === section.key ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label} ({templates[section.key]?.length || 0})
                </button>
              ))}
            </div>
            <div className="category-group">
              <h4>Lab Test Reports</h4>
              {sections.filter(s => s.category === 'lab').map(section => (
                <button
                  key={section.key}
                  className={`section-btn ${activeSection === section.key ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label} ({templates[section.key]?.length || 0})
                </button>
              ))}
            </div>
          </div>

          <div className="section-content">
            <div className="section-header">
              <h3>{sections.find(s => s.key === activeSection)?.label}</h3>
              <div className="add-item">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder={`Add new ${activeSection.slice(0, -1)}...`}
                  onKeyPress={(e) => e.key === 'Enter' && addItem()}
                />
                <button onClick={addItem} className="add-btn">Add</button>
              </div>
            </div>

            <div className="items-list">
              {templates[activeSection]?.map((item, index) => (
                <div key={index} className="item">
                  <span className="item-text">{item}</span>
                  <button
                    className="remove-btn"
                    onClick={() => removeItem(activeSection, index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="customizer-actions">
          <button className="cancel-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Templates'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateCustomizer;
