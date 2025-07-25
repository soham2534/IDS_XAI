import React, { useState } from 'react';
import '../Auth.css';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = (e) => {
    e.preventDefault();
    if (validateForm()) {
      navigate('/dashboard');
    }
  };

  const goToLogin = () => {
    navigate('/');
  };

  return (
    <div className="auth-container">
      <div className="logo">
        <img src={logo} alt="Explainable AI Logo" className="sidebar-logo" />
        <h3 className="logo-text">EXPLAINABLE AI</h3>
      </div>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
        <input 
          type="email" 
          placeholder="Email address" 
          value={email}
          onChange={(e) => setEmail(e.target.value)} 
        />
        {errors.email && <span style={{color: 'red', fontSize: '14px'}}>{errors.email}</span>}
        
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)} 
        />
        {errors.password && <span style={{color: 'red', fontSize: '14px'}}>{errors.password}</span>}
        
        <input 
          type="password" 
          placeholder="Confirm Password" 
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)} 
        />
        {errors.confirmPassword && <span style={{color: 'red', fontSize: '14px'}}>{errors.confirmPassword}</span>}
        
        <button type="submit">Sign Up</button>
        <button type="button" className="secondary-btn" onClick={goToLogin}>
          Sign In
        </button>
      </form>
    </div>
  );
}