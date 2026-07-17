import React, { useState } from 'react';
import { User, Lock, LogIn, UserPlus, Stethoscope, ArrowLeft, Mail } from 'lucide-react';
import { login, signup } from '../utils/api';

export default function LoginPanel({ onLoginSuccess }) {
  const [role, setRole] = useState(null); 
  

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  

  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regEmail, setRegEmail] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) {
      setErrorMsg('Please fill in all login fields');
      return;
    }
    setErrorMsg('');
    setLoginLoading(true);

    try {
      if (role === 'doctor') {

        onLoginSuccess(loginUser.trim(), 'doctor');
      } else {

        const data = await login(loginUser, loginPass);
        onLoginSuccess(data.username, 'patient');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regUser.trim() || !regPass.trim() || !regEmail.trim()) {
      setErrorMsg('Please fill in all register fields');
      return;
    }
    setErrorMsg('');
    setRegisterLoading(true);

    try {
 
      await signup(regUser, regPass, regEmail.trim());

      const data = await login(regUser, regPass);
      onLoginSuccess(data.username, 'patient');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleBackToRoles = () => {
    setRole(null);
    setErrorMsg('');
    setLoginUser('');
    setLoginPass('');
    setRegUser('');
    setRegPass('');
    setRegEmail('');
  };

  if (role === null) {
    return (
      <div className="login-panel-container">
        <div className="login-card" style={{ maxWidth: '500px' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Select Portal</h2>
          <div className="role-selection-grid">
            <button className="role-card-btn" onClick={() => setRole('patient')}>
              <User size={36} className="role-card-icon" />
              <h3>Patient Portal</h3>
              <p>Book appointments, view slots, and chat with MedSync assistant</p>
            </button>
            
            <button className="role-card-btn" onClick={() => setRole('doctor')}>
              <Stethoscope size={36} className="role-card-icon" />
              <h3>Doctor & Admin</h3>
              <p>View all system bookings, read user chats, and manage slots</p>
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (role === 'doctor') {
    return (
      <div className="login-panel-container">
        <div className="login-card">
          <button className="back-btn" onClick={handleBackToRoles}>
            <ArrowLeft size={16} /> Back
          </button>

          <h2 style={{ marginTop: '0.5rem' }}>Doctor Login</h2>
          <p>Access the admin and bookings clinic dashboard</p>

          {errorMsg && <div className="auth-error" style={{ marginBottom: '1rem' }}>{errorMsg}</div>}

          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Enter username"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  disabled={loginLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Enter password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  disabled={loginLoading}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loginLoading}>
              {loginLoading ? (
                'Processing...'
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <LogIn size={18} /> Log In
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }


  return (
    <div className="login-panel-container" style={{ flexDirection: 'column', gap: '1rem', minHeight: 'auto', padding: '1rem 2rem' }}>
      <button className="back-btn" onClick={handleBackToRoles} style={{ alignSelf: 'flex-start', maxWidth: '100px' }}>
        <ArrowLeft size={16} /> Back to selection
      </button>

      {errorMsg && (
        <div className="auth-error" style={{ width: '100%', maxWidth: '860px', marginBottom: '0.5rem' }}>
          {errorMsg}
        </div>
      )}

      <div className="patient-auth-row">
        {/* Left Card: Patient Register Panel */}
        <div className="login-card" style={{ maxWidth: '420px', flex: 1 }}>
          <h2>Patient Register</h2>
          <p>Register as a new patient to access assistant chat</p>

          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <div className="form-group">
              <label htmlFor="reg-username">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="reg-username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Create username"
                  value={regUser}
                  onChange={(e) => setRegUser(e.target.value)}
                  disabled={registerLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="reg-password"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Create password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  disabled={registerLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Enter email address"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={registerLoading}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={registerLoading} style={{ backgroundColor: 'var(--accent-teal)' }}>
              {registerLoading ? (
                'Processing...'
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <UserPlus size={18} /> Register & Start Chat
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Right Card: Patient Login Panel */}
        <div className="login-card" style={{ maxWidth: '420px', flex: 1 }}>
          <h2>Patient Login</h2>
          <p>Log in with your existing account to resume chats</p>

          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="login-username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Enter username"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  disabled={loginLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Enter password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  disabled={loginLoading}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loginLoading}>
              {loginLoading ? (
                'Processing...'
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <LogIn size={18} /> Log In
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
