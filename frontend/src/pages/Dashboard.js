import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [userEmail, setUserEmail] = useState('');
  const [features, setFeatures] = useState(Array(10).fill(''));
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelAvailable, setModelAvailable] = useState(false);
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
            🤖 Explainable AI Dashboard
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
          <strong>⚠️ Model Status:</strong> ML model is not loaded. Prediction functionality is disabled.
        </div>
      )}

      {/* Feature Input Section */}
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
            📊 Input Features
          </h2>
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
                Feature {index + 1}:
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

        {/* Predict Button */}
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
          {loading ? 'Predicting...' : modelAvailable ? '🔮 Make Prediction' : 'Model Unavailable'}
        </button>
      </div>

      {/* Prediction Results */}
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
            🎯 Prediction Results
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#155724',
              color: 'white',
              borderRadius: '25px',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              Prediction: {prediction.prediction}
            </div>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ 
              color: '#155724', 
              marginBottom: '12px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              🔍 Top Contributing Features:
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {prediction.top_features.map((featureIndex, index) => (
                <span
                  key={index}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#155724',
                    color: 'white',
                    borderRadius: '15px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Feature {featureIndex + 1}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h4 style={{ 
              color: '#155724', 
              marginBottom: '15px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              📈 SHAP Values (Feature Importance):
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
              gap: '8px'
            }}>
              {prediction.shap_values.map((value, index) => (
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
              ))}
            </div>
            <div style={{ 
              marginTop: '15px', 
              fontSize: '12px', 
              color: '#155724',
              fontStyle: 'italic'
            }}>
              💡 Positive values (green) increase the prediction, negative values (red) decrease it.
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
          📝 How to Use
        </h3>
        <ul style={{ 
          margin: '0', 
          paddingLeft: '20px',
          lineHeight: '1.6',
          color: '#6c757d'
        }}>
          <li>Enter numeric values for all 10 features</li>
          <li>Click "Fill Sample Data" to populate with example values</li>
          <li>Click "Make Prediction" to get the ML model's prediction</li>
          <li>View SHAP values to understand which features influenced the prediction</li>
          <li>Green SHAP values increase the prediction, red values decrease it</li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;