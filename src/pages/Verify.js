import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logo from '../assets/logo.png';
import '../Auth.css';

const Verify = () => {
  const [message, setMessage] = useState('Verifying your email...');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if user is already logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
      navigate('/dashboard');
      return;
    }

    const token = searchParams.get('token');
    
    if (!token) {
      setMessage('Invalid verification link. No token provided.');
      setLoading(false);
      return;
    }

    const verifyEmail = async (token) => {
      try {
        const response = await fetch('http://localhost:8000/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setMessage(data.message || 'Email verified successfully!');
          setSuccess(true);
          
          // Auto redirect to login after 4 seconds
          setTimeout(() => {
            navigate('/', { 
              state: { 
                message: ' Email verified successfully! You can now log in with your credentials.' 
              } 
            });
          }, 4000);
        } else {
          setMessage(data.detail || 'Email verification failed. The link may be invalid or expired.');
          setSuccess(false);
        }
      } catch (error) {
        console.error('Verification error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          setMessage('Cannot connect to server. Please make sure the backend is running and try again.');
        } else {
          setMessage('Network error during verification. Please check your connection and try again.');
        }
        setSuccess(false);
      } finally {
        setLoading(false);
      }
    };

    verifyEmail(token);
  }, [searchParams, navigate]);

  const handleGoToLogin = () => {
    navigate('/', { 
      state: { 
        message: success ? ' Email verified successfully! You can now log in with your credentials.' : null
      } 
    });
  };

  const handleResendVerification = () => {
    navigate('/signup', {
      state: {
        message: 'Please sign up again to receive a new verification email.'
      }
    });
  };

  return (
    <div className="auth-container">
      <div className="app-logo">
        <img src={logo} alt="Explainable AI Logo" className="logo-image" />
        <h1 className="logo-text">EXPLAINABLE AI</h1>
      </div>
      
      <h2>Email Verification</h2>
      
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        backgroundColor: success ? '#d4edda' : loading ? '#fff3cd' : '#f8d7da',
        border: `1px solid ${success ? '#c3e6cb' : loading ? '#ffeaa7' : '#f5c6cb'}`,
        borderRadius: '8px',
        color: success ? '#155724' : loading ? '#856404' : '#721c24',
        marginBottom: '20px'
      }}>
        {loading && (
          <div>
            <div style={{ 
              width: '24px', 
              height: '24px', 
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #856404',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 15px'
            }}></div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '10px' }}>
          {loading ? '⏳' : success ? '✅' : '❌'}
        </div>
        
        <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.5' }}>
          {message}
        </p>
        
        {success && !loading && (
          <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
            Redirecting to login page in a few seconds...
          </p>
        )}
      </div>

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            type="button"
            onClick={handleGoToLogin}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: success ? '#28a745' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.3s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = success ? '#218838' : '#0056b3'}
            onMouseOut={(e) => e.target.style.backgroundColor = success ? '#28a745' : '#007bff'}
          >
            {success ? 'Go to Login' : 'Back to Login'}
          </button>

          {!success && (
            <button 
              type="button"
              onClick={handleResendVerification}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#007bff',
                border: '2px solid #007bff',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#007bff';
                e.target.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#007bff';
              }}
            >
              Get New Verification Email
            </button>
          )}
        </div>
      )}

      {!success && !loading && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#6c757d',
          lineHeight: '1.5'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>Troubleshooting:</p>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Check if the verification link has expired</li>
            <li>Make sure you clicked the correct link from your email</li>
            <li>Try signing up again if the link is too old</li>
            <li>Contact support if the problem persists</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default Verify;