import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import '../Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if user is already logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
      navigate('/dashboard');
      return;
    }

    // Show message from signup redirect or verification
    if (location.state?.message) {
      setSuccess(location.state.message);
      // Clear the message after showing it
      setTimeout(() => setSuccess(''), 5000);
    }
  }, [location.state, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear errors when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateForm = () => {
    const { email, password } = formData;
    
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store user info in localStorage
        localStorage.setItem('userEmail', formData.email.trim());
        localStorage.setItem('isLoggedIn', 'true');
        
        setSuccess('Login successful! Redirecting to dashboard...');
        
        // Clear form
        setFormData({ email: '', password: '' });
        
        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        // Handle specific error cases
        switch (response.status) {
          case 403:
            setError('Please verify your email before logging in. Check your inbox for the verification link.');
            break;
          case 401:
            setError('Invalid email or password. Please check your credentials.');
            break;
          case 400:
            setError(data.detail || 'Please enter a valid email address.');
            break;
          default:
            setError(data.detail || 'Login failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Cannot connect to server. Please make sure the backend is running on http://localhost:8000');
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="app-logo">
        <div className="logo">🔒</div>
        <h1 className="logo-text">EXPLAINABLE AI</h1>
      </div>
      
      <h2>Sign In</h2>
      
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          name="email"
          placeholder="Email address"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={loading}
          autoComplete="email"
        />
        
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={loading}
          autoComplete="current-password"
        />
        
        {error && (
          <div style={{ 
            color: '#dc3545', 
            fontSize: '14px', 
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#f8d7da',
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ 
            color: '#155724', 
            fontSize: '14px', 
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            border: '1px solid #c3e6cb'
          }}>
            {success}
          </div>
        )}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
      
      <button 
        type="button" 
        className="secondary-btn"
        onClick={() => navigate('/signup')}
        disabled={loading}
      >
        Create Account
      </button>
      
      <p>
        Don't have an account? <Link to="/signup">Sign up here</Link>
      </p>
    </div>
  );
};

export default Login;