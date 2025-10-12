import React from 'react';
import './Sidebar.css';
import logo from '../assets/logo.png';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="logo">
        <img src={logo} alt="Explainable AI Logo" className="sidebar-logo" />
        <h2>IDS Panel</h2>
      </div>
      <nav>
        <a href="/dashboard">Dashboard</a>
        <a href="/">Logout</a>
      </nav>
    </div>
  );
}
