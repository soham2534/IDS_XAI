import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [userEmail, setUserEmail] = useState('');
  const [features, setFeatures] = useState(Array(10).fill(''));
  const [prediction, setPrediction] = useState(null);
  const [csvPredictions, setCsvPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [error, setError] = useState('');
  const [csvError, setCsvError] = useState('');
  const [modelAvailable, setModelAvailable] = useState(false);
  const [inputMode, setInputMode] = useState('manual'); // 'manual' or 'csv'
  const [featureNames, setFeatureNames] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const email = localStorage.getItem('userEmail');
    
    if (!isLoggedIn || !email || isLoggedIn !== 'true') {
      navigate('/');
      return;
    }
    
    setUserEmail(email);
    
    // Check if backend and model are available
    checkBackendHealth();
    
    // Load feature names
    loadFeatureNames();
  }, [navigate]);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch('http://localhost:8000/health');
      const data = await response.json();
      
      if (response.ok) {
        setModelAvailable(data.model_loaded || false);
        if (!data.model_loaded) {
          setError('ML model is not loaded. Prediction functionality is disabled.');
        }
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setError('Cannot connect to backend server. Please ensure it\'s running.');
    }
  };

  const loadFeatureNames = async () => {
    try {
      const response = await fetch('http://localhost:8000/feature-names');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setFeatureNames(data.feature_names || []);
      }
    } catch (error) {
      console.error('Failed to load feature names:', error);
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setCsvError('Please select a CSV file');
      return;
    }

    setCsvLoading(true);
    setCsvError('');
    setCsvPredictions(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/upload-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCsvPredictions(data);
      } else {
        setCsvError(data.detail || 'CSV processing failed');
      }
    } catch (error) {
      console.error('CSV upload error:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setCsvError('Cannot connect to server. Please make sure the backend is running.');
      } else {
        setCsvError('Network error during CSV upload. Please try again.');
      }
    } finally {
      setCsvLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear all stored data
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    
    // Redirect to login
    navigate('/', {
      state: {
        message: 'You have been logged out successfully.'
      }
    });
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
    
    // Clear previous prediction when features change
    if (prediction) {
      setPrediction(null);
    }
    if (error && !error.includes('ML model')) {
      setError('');
    }
  };

  const validateFeatures = () => {
    const numericFeatures = features.map(f => {
      const num = parseFloat(f);
      return isNaN(num) ? null : num;
    });
    
    const emptyFields = numericFeatures.filter(f => f === null).length;
    if (emptyFields > 0) {
      setError(`Please fill all ${features.length} feature fields with valid numeric values. ${emptyFields} fields are empty or invalid.`);
      return null;
    }
    
    return numericFeatures;
  };

  const handlePredict = async () => {
    if (!modelAvailable) {
      setError('ML model is not available. Please contact the administrator.');
      return;
    }

    const numericFeatures = validateFeatures();
    if (!numericFeatures) return;

    setLoading(true);
    setError('');
    setPrediction(null);

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          features: numericFeatures
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPrediction(data);
      } else {
        setError(data.detail || 'Prediction failed. Please check your input values.');
      }
    } catch (error) {
      console.error('Prediction error:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Cannot connect to server. Please make sure the backend is running.');
      } else {
        setError('Network error during prediction. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    setFeatures(Array(10).fill(''));
    setPrediction(null);
    setError('');
  };

  const fillSampleData = () => {
    const sampleFeatures = [
      '1.5', '2.3', '0.8', '4.2', '1.1',
      '3.7', '0.9', '2.8', '1.6', '3.4'
    ];
    setFeatures(sampleFeatures);
    setPrediction(null);
    if (error && !error.includes('ML model')) {
      setError('');
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1000px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #eee',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ 
            margin: '0', 
            color: '#333',
            fontSize: '28px',
            fontWeight: '600'
          }}>
             Explainable AI Dashboard
          </h1>
          <p style={{ 
            margin: '5px 0 0 0', 
            color: '#666',
            fontSize: '16px'
          }}>
            Welcome back, <strong>{userEmail}</strong>
          </p>
        </div>
        <button 
          onClick={handleLogout}
          style={{
            padding: '12px 24px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
        >
          Logout
        </button>
      </div>

      {/* Status Alert */}
      {!modelAvailable && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          color: '#856404',
          marginBottom: '25px'
        }}>
          <strong> Model Status:</strong> ML model is not loaded. Prediction functionality is disabled.
        </div>
      )}

      {/* Input Mode Selection */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <h2 style={{ 
            color: '#333', 
            margin: '0',
            fontSize: '22px',
            fontWeight: '600'
          }}>
             Input Method
          </h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setInputMode('manual')}
              style={{
                padding: '8px 16px',
                backgroundColor: inputMode === 'manual' ? '#007bff' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Manual Input
            </button>
            <button
              onClick={() => setInputMode('csv')}
              style={{
                padding: '8px 16px',
                backgroundColor: inputMode === 'csv' ? '#007bff' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              CSV Upload
            </button>
          </div>
        </div>

        {/* Input Mode Content */}
        {inputMode === 'manual' ? (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <h3 style={{ 
                color: '#333', 
                margin: '0',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                 Manual Feature Input
              </h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={fillSampleData}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Fill Sample Data
                </button>
                <button
                  onClick={handleClearForm}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{ 
              color: '#333', 
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              CSV File Upload
            </h3>
            
            <div style={{
              padding: '20px',
              border: '2px dashed #007bff',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: '#f8f9fa',
              marginBottom: '20px'
            }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                style={{ display: 'none' }}
                id="csv-upload"
                disabled={csvLoading || !modelAvailable}
              />
              <label
                htmlFor="csv-upload"
                style={{
                  cursor: csvLoading || !modelAvailable ? 'not-allowed' : 'pointer',
                  display: 'block',
                  padding: '20px'
                }}
              >
                {csvLoading ? (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                    <div>Processing CSV file...</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>📁</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                      Click to upload CSV file
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      Expected features: {featureNames.length} columns
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                      Supports partial features (missing columns will be filled with 0)
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {inputMode === 'manual' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '15px',
            marginBottom: '25px'
          }}>
            {features.map((feature, index) => (
              <div key={index}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '600',
                  color: '#555',
                  fontSize: '14px'
                }}>
                  {featureNames[index] || `Feature ${index + 1}`}:
                </label>
                <input
                  type="number"
                  step="any"
                  value={feature}
                  onChange={(e) => handleFeatureChange(index, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    transition: 'border-color 0.3s',
                    boxSizing: 'border-box'
                  }}
                  placeholder={`Value ${index + 1}`}
                  onFocus={(e) => e.target.style.borderColor = '#007bff'}
                  onBlur={(e) => e.target.style.borderColor = '#ddd'}
                />
              </div>
            ))}
          </div>
        )}

        {/* CSV Error Display */}
        {csvError && (
          <div style={{ 
            color: '#dc3545', 
            backgroundColor: '#f8d7da',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid #f5c6cb',
            fontSize: '14px'
          }}>
            <strong>CSV Error:</strong> {csvError}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{ 
            color: '#dc3545', 
            backgroundColor: '#f8d7da',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid #f5c6cb',
            fontSize: '14px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Predict Button - Only for manual input */}
        {inputMode === 'manual' && (
          <button 
            onClick={handlePredict}
            disabled={loading || !modelAvailable}
            style={{
              padding: '14px 30px',
              backgroundColor: loading || !modelAvailable ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || !modelAvailable ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'background-color 0.3s',
              minWidth: '160px'
            }}
            onMouseOver={(e) => {
              if (!loading && modelAvailable) {
                e.target.style.backgroundColor = '#0056b3';
              }
            }}
            onMouseOut={(e) => {
              if (!loading && modelAvailable) {
                e.target.style.backgroundColor = '#007bff';
              }
            }}
          >
            {loading ? 'Predicting...' : modelAvailable ? ' Make Prediction' : 'Model Unavailable'}
          </button>
        )}
      </div>

      {/* CSV Results */}
      {csvPredictions && (
        <div style={{ 
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d9ff',
          borderRadius: '8px',
          padding: '25px',
          marginTop: '30px'
        }}>
          <h3 style={{ 
            color: '#0066cc', 
            marginTop: '0',
            marginBottom: '20px',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            📊 CSV Processing Results
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}>
                <strong>File:</strong> {csvPredictions.filename}
              </div>
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}>
                <strong>Rows:</strong> {csvPredictions.total_rows}
              </div>
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}>
                <strong>Features in CSV:</strong> {csvPredictions.features_in_csv}
              </div>
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}>
                <strong>Expected Features:</strong> {csvPredictions.features_expected}
              </div>
            </div>
          </div>

          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto',
            border: '1px solid #ddd',
            borderRadius: '6px',
            backgroundColor: 'white'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Row</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Vulnerability</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Attack Type</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Features Used</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {csvPredictions.predictions.map((pred, index) => (
                  <tr key={index}>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{pred.row}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                      {pred.error ? (
                        <span style={{ color: '#dc3545' }}>Error</span>
                      ) : (
                        <span style={{ 
                          padding: '4px 8px',
                          backgroundColor: pred.is_vulnerable ? '#f8d7da' : '#d4edda',
                          color: pred.is_vulnerable ? '#721c24' : '#155724',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {pred.vulnerability_status}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                      {pred.error ? '-' : (
                        <span style={{ 
                          fontSize: '12px',
                          color: '#495057'
                        }}>
                          {pred.attack_type}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                      {pred.error ? '-' : `${pred.features_used}/${pred.features_expected}`}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                      {pred.error ? (
                        <span style={{ color: '#dc3545', fontSize: '12px' }}>Failed</span>
                      ) : (
                        <span style={{ color: '#28a745', fontSize: '12px' }}>✅ Success</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Prediction Results */}
      {prediction && (
        <div style={{ 
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          padding: '25px',
          marginTop: '30px'
        }}>
          <h3 style={{ 
            color: '#155724', 
            marginTop: '0',
            marginBottom: '20px',
            fontSize: '20px',
            fontWeight: '600'
          }}>
             Prediction Results
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'inline-block',
              padding: '15px 25px',
              backgroundColor: prediction.is_vulnerable ? '#dc3545' : '#28a745',
              color: 'white',
              borderRadius: '25px',
              fontSize: '18px',
              fontWeight: '600',
              marginRight: '15px'
            }}>
              {prediction.vulnerability_status}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              borderRadius: '20px',
              fontSize: '16px',
              fontWeight: '500'
            }}>
              Type: {prediction.attack_type}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              borderRadius: '15px',
              fontSize: '14px',
              fontWeight: '500',
              marginLeft: '15px'
            }}>
              ID: {prediction.prediction}
            </div>
          </div>

          {/* Top Contributing Features Table */}
          {prediction.top_features_detailed && prediction.top_features_detailed.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#155724', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
                Why this prediction? Top contributing features:
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f8f9fa', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #2dde71' }}>Feature</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #2dde71' }}>Value</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #2dde71' }}>SHAP Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {prediction.top_features_detailed.map((feat, i) => (
                    <tr key={i} style={{ backgroundColor: i%2===0? '#f2fefd': 'white', fontSize: '15px' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#155724' }}>
                        {feat.feature_name}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#444' }}>{Number(feat.feature_value).toFixed(3)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '700', color: feat.shap_value >= 0 ? '#27ae60' : '#e74c3c' }}>
                        {feat.shap_value >= 0 ? '+' : ''}{Number(feat.shap_value).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '7px', fontSize: '12px', color: '#888' }}>
                Highest positive SHAP values increase the prediction. Negative values decrease it.
              </div>
            </div>
          )}
          
          <div>
            <h4 style={{ 
              color: '#155724', 
              marginBottom: '15px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
               SHAP Values (Feature Importance):
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
              gap: '8px'
            }}>
              {prediction.shap_values && Array.isArray(prediction.shap_values) ? (
                prediction.shap_values.map((value, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      padding: '10px',
                      backgroundColor: value >= 0 ? '#c8e6c9' : '#ffcdd2',
                      borderRadius: '6px',
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: '500',
                      border: `2px solid ${value >= 0 ? '#4caf50' : '#f44336'}`
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                      F{index + 1}
                    </div>
                    <div style={{ 
                      color: value >= 0 ? '#2e7d32' : '#c62828',
                      fontWeight: '600'
                    }}>
                      {value >= 0 ? '+' : ''}{value.toFixed(4)}
                    </div>
                  </div>
                ))
              ) : (
                <div>No SHAP values available</div>
              )}

            </div>
            <div style={{ 
              marginTop: '15px', 
              fontSize: '12px', 
              color: '#155724',
              fontStyle: 'italic'
            }}>
               Positive values (green) increase the prediction, negative values (red) decrease it.
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ 
          color: '#495057', 
          marginTop: '0',
          marginBottom: '15px',
          fontSize: '18px'
        }}>
          How to Use
        </h3>
        
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#495057', marginBottom: '10px', fontSize: '16px' }}>
            📝 Manual Input Mode:
          </h4>
          <ul style={{ 
            margin: '0', 
            paddingLeft: '20px',
            lineHeight: '1.6',
            color: '#6c757d'
          }}>
            <li>Enter numeric values for features (supports partial input)</li>
            <li>Click "Fill Sample Data" to populate with example values</li>
            <li>Click "Make Prediction" to get the ML model's prediction</li>
            <li>View SHAP values to understand feature importance</li>
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#495057', marginBottom: '10px', fontSize: '16px' }}>
            📁 CSV Upload Mode:
          </h4>
          <ul style={{ 
            margin: '0', 
            paddingLeft: '20px',
            lineHeight: '1.6',
            color: '#6c757d'
          }}>
            <li>Upload a CSV file with your feature data</li>
            <li>Supports partial features (missing columns filled with 0)</li>
            <li>Each row represents one prediction sample</li>
            <li>View batch results in a table format</li>
            <li>Expected {featureNames.length} features, but works with fewer (20-30 features)</li>
          </ul>
        </div>

        <div style={{ 
          marginTop: '15px',
          padding: '15px',
          backgroundColor: '#e7f3ff',
          borderRadius: '6px',
          border: '1px solid #b3d9ff',
          fontSize: '14px',
          color: '#0066cc'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>💡 Tips:</div>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>You can provide 20-30 features instead of all {featureNames.length} features</li>
            <li>The model will automatically fill missing features with default values (0)</li>
            <li><strong>0 = Benign (Safe)</strong>, <strong>1-15 = Attack Types</strong></li>
            <li>Attack types include: Bot, Brute Force, DDoS, DoS, SQL Injection, etc.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;