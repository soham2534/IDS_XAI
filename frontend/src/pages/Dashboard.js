import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const newLogs = [
      { ip: '192.168.1.5', attack: 'DoS Attack', severity: 'High' },
      { ip: '10.0.0.23', attack: 'Port Scan', severity: 'Medium' },
      { ip: '172.16.8.4', attack: 'R2L', severity: 'Low' },
      { ip: '192.168.0.8', attack: 'Probe', severity: 'Medium' }
    ].map(entry => ({
      ...entry,
      timestamp: new Date().toLocaleString()
    }));
    setLogs(newLogs);
  }, []);

  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <div className="dashboard-content-card">
          <h1>Dashboard</h1>
          <div className="stats">
            <div className="stat red">23<br />Intrusions Detected</div>
            <div className="stat blue">10,567<br />Packets Analyzed</div>
            <div className="stat yellow">3<br />False Positives</div>
          </div>
          <h2>Intrusion Logs</h2>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>IP</th>
                <th>Attack Type</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i}>
                  <td>{log.timestamp}</td>
                  <td>{log.ip}</td>
                  <td>{log.attack}</td>
                  <td className={log.severity.toLowerCase()}>{log.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
