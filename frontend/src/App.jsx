import React, { useState, useEffect, useRef } from 'react';
import { Stethoscope, MessageSquare, Plus, Trash2, LogOut, RefreshCw, Calendar, Clock } from 'lucide-react';
import ChatPanel from './components/ChatPanel';
import LoginPanel from './components/LoginPanel';
import { getSessions, deleteSession, startSession, getBookings, cancelBooking } from './utils/api';

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('medsync_user'));
  const [role, setRole] = useState(() => localStorage.getItem('medsync_role')); // 'patient' or 'doctor'
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const sessionsRef = useRef(sessions);
  const activeSessionIdRef = useRef(activeSessionId);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const handleLogin = (username, userRole) => {
    setUser(username);
    setRole(userRole);
    localStorage.setItem('medsync_user', username);
    localStorage.setItem('medsync_role', userRole);
  };

  const handleLogout = () => {
    setUser(null);
    setRole(null);
    setSessions([]);
    setActiveSessionId(null);
    setBookings([]);
    localStorage.removeItem('medsync_user');
    localStorage.removeItem('medsync_role');
  };

  // Fetch session list depending on role
  const fetchSessionsList = async (targetRole, targetUser) => {
    if (!targetUser) return;
    setLoadingSessions(true);
    try {
      // If doctor, fetch ALL sessions. If patient, fetch ONLY user's sessions.
      const list = await getSessions(targetRole === 'doctor' ? '' : targetUser);
      setSessions(list);
      
      // Auto-select first session if none is active
      if (list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].session_id);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch bookings (all bookings for doctor, user's own bookings for patient)
  const fetchBookingsList = async () => {
    if (!user) return;
    setLoadingBookings(true);
    try {
      const data = await getBookings(role === 'doctor' ? '' : user);
      setBookings(data);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Set up polling to check if the Doctor cancelled/deleted the session
  useEffect(() => {
    if (!user || !role) return;

    // Initial fetch
    fetchSessionsList(role, user);
    fetchBookingsList();

    const interval = setInterval(async () => {
      try {
        const list = await getSessions(role === 'doctor' ? '' : user);
        
        if (role === 'patient' && activeSessionIdRef.current) {
          const sessionStillExists = list.some((s) => s.session_id === activeSessionIdRef.current);
          if (!sessionStillExists && sessionsRef.current.length > 0) {
            const wasInPrevList = sessionsRef.current.some((s) => s.session_id === activeSessionIdRef.current);
            if (wasInPrevList) {
              alert("Your booking has been cancelled by the Doctor.");
              setActiveSessionId(null);
            }
          }
        }
        
        setSessions(list);
        
        const bookingsData = await getBookings(role === 'doctor' ? '' : user);
        setBookings(bookingsData);
      } catch (err) {
        console.error('Polling sync error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [user, role]);

  // Start new booking chat session (Patient only)
  const handleNewChat = async () => {
    if (!user) return;
    try {
      const data = await startSession(user);
      setActiveSessionId(data.session_id);
      await fetchSessionsList(role, user);
      setActiveSessionId(data.session_id);
    } catch (err) {
      alert('Failed to start a new chat: ' + err.message);
    }
  };

  // Delete chat session
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this chat session?')) {
      return;
    }
    try {
      await deleteSession(sessionId);
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.session_id !== sessionId);
        setActiveSessionId(remaining.length > 0 ? remaining[0].session_id : null);
      }
      fetchSessionsList(role, user);
    } catch (err) {
      alert('Failed to delete session: ' + err.message);
    }
  };

  // Cancel booking (Doctor only)
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking slot?')) {
      return;
    }
    try {
      await cancelBooking(bookingId, role);
      fetchBookingsList();
      // Also refresh sessions to reflect cancellation in chat if active
      fetchSessionsList(role, user);
    } catch (err) {
      alert('Failed to cancel booking: ' + err.message);
    }
  };

  // Callback when booking or action is confirmed in ChatPanel
  const handleChatTriggerRefresh = () => {
    fetchSessionsList(role, user);
    fetchBookingsList();
  };

  if (!user) {
    return (
      <>
        <header className="app-header">
          <div className="brand">
            <Stethoscope size={28} className="brand-icon" />
            <h1>MedSync Clinic Portal</h1>
          </div>
        </header>
        <LoginPanel onLoginSuccess={handleLogin} />
      </>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <Stethoscope size={28} className="brand-icon" />
          <h1>MedSync Clinic Portal</h1>
        </div>
        <div className="header-status">
          <span className="status-dot"></span>
          <span>Welcome, {user} ({role === 'doctor' ? 'Doctor' : 'Patient'})</span>
        </div>
      </header>

      <main className="portal-container">
        {/* Left Sidebar */}
        <aside className="sidebar-panel">
          {role === 'patient' && (
            <button className="new-chat-btn" onClick={handleNewChat}>
              <Plus size={18} /> New Booking Chat
            </button>
          )}

          <div className="session-list-container">
            <h4 className="sidebar-title">{role === 'doctor' ? 'All User Chats' : 'My Booking Chats'}</h4>
            {loadingSessions && sessions.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading chats...
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active booking chats.
              </div>
            ) : (
              sessions.map((session) => {
                const ctx = session.booking_context || {};
                const hasDetails = ctx.date || ctx.patient_name || ctx.problem;
                
                return (
                  <div
                    key={session.session_id}
                    className={`session-item-row ${activeSessionId === session.session_id ? 'active' : ''}`}
                    onClick={() => setActiveSessionId(session.session_id)}
                    style={{ 
                      flexDirection: 'column', 
                      alignItems: 'stretch', 
                      padding: '0.85rem',
                      height: 'auto',
                      gap: '0.35rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div className="session-item-info" style={{ flex: 1, minWidth: 0 }}>
                        <MessageSquare size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary)' }} />
                        <span className="session-item-title" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white' }}>
                          {role === 'doctor'
                            ? (() => {
                                const parts = [];
                                if (ctx.patient_name) parts.push(ctx.patient_name);
                                if (ctx.problem) parts.push(ctx.problem);
                                if (ctx.date) parts.push(`${ctx.date}${ctx.time_slot ? ` @ ${ctx.time_slot}` : ''}`);
                                return parts.length > 0
                                  ? parts.join(' · ')
                                  : `${session.username} — pending`;
                              })()
                            : (ctx.date ? `${ctx.date}${ctx.time_slot ? ` @ ${ctx.time_slot}` : ''}` : 'New Booking Chat')}
                        </span>
                      </div>
                      <button
                        className="session-delete-btn"
                        onClick={(e) => handleDeleteSession(e, session.session_id)}
                        title="Delete Chat"
                        style={{ margin: 0, padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    
                    {hasDetails && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '1.25rem', borderLeft: '1px solid var(--border-color)', marginTop: '2px' }}>
                        {ctx.time_slot && (
                          <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 500 }}>
                            Time: {ctx.time_slot}
                          </div>
                        )}
                        {ctx.patient_name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <strong>Patient:</strong> {ctx.patient_name}
                          </div>
                        )}
                        {ctx.problem && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            "{ctx.problem}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="sidebar-profile">
            <div className="profile-info">
              <div className="profile-avatar" style={{ backgroundColor: role === 'doctor' ? 'var(--color-booked)' : 'var(--accent-teal)' }}>
                {role === 'doctor' ? 'Dr' : user.charAt(0).toUpperCase()}
              </div>
              <span className="profile-name" title={user}>{user}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        {/* Center Chat Panel */}
        <div className="portal-chat-panel">
          {activeSessionId ? (
            <ChatPanel
              key={activeSessionId}
              sessionId={activeSessionId}
              username={user}
              onBookingConfirmed={handleChatTriggerRefresh}
            />
          ) : (
            <div
              className="glass-panel"
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
              }}
            >
              Select a conversation from the sidebar to view chat history.
            </div>
          )}
        </div>

        {/* Right Sidebar Column (Doctor and Patient Bookings) */}
        <aside className="bookings-column">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="slots-grid-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} /> {role === 'doctor' ? 'Clinic Bookings' : 'My Bookings'}
            </h3>
            <button className="refresh-btn" onClick={fetchBookingsList} disabled={loadingBookings}>
              <RefreshCw size={14} className={loadingBookings ? 'spin' : ''} />
            </button>
          </div>

          <div className="bookings-list" style={{ flex: 1, overflowY: 'auto' }}>
            {loadingBookings && bookings.length === 0 ? (
              <div className="no-bookings">Loading bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="no-bookings">
                {role === 'doctor' ? 'No active bookings in the database.' : 'You have no confirmed bookings.'}
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="booking-card" style={{ padding: '0.85rem' }}>
                  <div className="booking-card-main" style={{ gap: '0.15rem' }}>
                    <div className="booking-card-title" style={{ fontSize: '0.88rem' }}>
                      <span>{booking.date}</span>
                      <span className="booking-time-badge" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}>
                        {booking.time_slot}
                      </span>
                    </div>
                    <div className="booking-card-patient" style={{ fontSize: '0.8rem' }}>
                      <strong>Patient:</strong> {booking.patient_name || 'Anonymous'}
                    </div>
                    <div className="booking-card-reason" style={{ fontSize: '0.78rem' }}>
                      "{booking.problem}"
                    </div>
                    {role === 'doctor' && (
                      <div className="booking-card-reason" style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '2px' }}>
                        User: {booking.username || 'guest'}
                      </div>
                    )}
                  </div>
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancelBooking(booking.id)}
                    title="Cancel Booking Slot"
                    style={{ padding: '0.35rem' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </>
  );
}

export default App;
