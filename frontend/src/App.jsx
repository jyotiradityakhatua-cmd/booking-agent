import React, { useState, useEffect, useRef } from 'react';
import { Stethoscope, MessageSquare, Plus, Trash2, LogOut, RefreshCw, Calendar, Clock, User, FileText, CheckCircle } from 'lucide-react';
import ChatPanel from './components/ChatPanel';
import LoginPanel from './components/LoginPanel';
import DoctorDashboard from './components/DoctorDashboard';
import { getSessions, deleteSession, startSession, getBookings, cancelBooking } from './utils/api';
import './bell.css';

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('medsync_user'));
  const [role, setRole] = useState(() => localStorage.getItem('medsync_role'));
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef(null);

  const sessionsRef = useRef(sessions);
  const activeSessionIdRef = useRef(activeSessionId);

  // Refs for tracking previous bookings and manual cancellations
  const prevBookingsRef = useRef([]);
  const patientCancelledBookingIdsRef = useRef(new Set());

  // Compare bookings to detect doctor-initiated cancellations
  useEffect(() => {
    if (role !== 'patient' || !user) {
      prevBookingsRef.current = bookings;
      return;
    }

    if (bookings.length === 0 && prevBookingsRef.current.length === 0) {
      prevBookingsRef.current = bookings;
      return;
    }

    // Detect if any booking in prevBookingsRef is missing in the new bookings list
    const missingBookings = prevBookingsRef.current.filter(
      (prevB) => !bookings.some((b) => b.id === prevB.id)
    );

    if (missingBookings.length > 0) {
      let updatedNotifs = false;
      const key = `medsync_notifs_${user}`;
      let storedNotifs = [];
      try {
        const stored = localStorage.getItem(key);
        storedNotifs = stored ? JSON.parse(stored) : [];
      } catch (e) {
        storedNotifs = [];
      }

      missingBookings.forEach((booking) => {
        // Only trigger if this booking was NOT cancelled by the patient
        if (!patientCancelledBookingIdsRef.current.has(booking.id)) {
          const notifId = `cancel-booking-${booking.id}`;
          if (!storedNotifs.some((n) => n.id === notifId)) {
            storedNotifs.unshift({
              id: notifId,
              message: `Your appointment on ${booking.date} @ ${booking.time_slot} has been cancelled by the Doctor.`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: false,
            });
            updatedNotifs = true;
          }
        }
      });

      if (updatedNotifs) {
        localStorage.setItem(key, JSON.stringify(storedNotifs));
        // Dispatch custom event to notify ChatPanel to reload notifications
        window.dispatchEvent(new Event('medsync_notifs_updated'));
      }
    }

    prevBookingsRef.current = bookings;
  }, [bookings, user, role]);

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


  const fetchSessionsList = async (targetRole, targetUser) => {
    if (!targetUser) return;
    setLoadingSessions(true);
    try {

      const list = await getSessions(targetRole === 'doctor' ? '' : targetUser);
      setSessions(list);


      if (list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].session_id);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };


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


  useEffect(() => {
    if (!user || !role) return;


    fetchSessionsList(role, user);
    fetchBookingsList();

    const interval = setInterval(async () => {

      setRefreshing(true);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => setRefreshing(false), 700);

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

    return () => {
      clearInterval(interval);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [user, role]);


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


  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking slot?')) {
      return;
    }
    try {
      patientCancelledBookingIdsRef.current.add(bookingId);
      await cancelBooking(bookingId, role);
      fetchBookingsList();
      fetchSessionsList(role, user);
    } catch (err) {
      alert('Failed to cancel booking: ' + err.message);
    }
  };


  const handleChatTriggerRefresh = () => {
    fetchSessionsList(role, user);
    fetchBookingsList();
  };


  const handleDoctorRefresh = () => {
    fetchBookingsList();
    fetchSessionsList(role, user);
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


  if (role === 'doctor') {
    return (
      <>
        <header className="app-header">
          <div className="brand">
            <Stethoscope size={28} className="brand-icon" />
            <h1>MedSync Clinic Portal</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="header-status">
              <span className="status-dot"></span>
              <span>Dr. {user}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Log Out" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '1.5rem', display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '1400px' }}>
            <DoctorDashboard
              bookings={bookings}
              loadingBookings={loadingBookings}
              onRefresh={handleDoctorRefresh}
              sessions={sessions}
              refreshing={refreshing}
            />
          </div>
        </main>
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
          <span>Welcome, {user} (Patient)</span>
        </div>
      </header>

      <main className="portal-container">
        {/* Left Sidebar — Patient booking chats */}
        <aside className="sidebar-panel">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <Plus size={18} /> New Booking Chat
          </button>

          <div className="session-list-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h4 className="sidebar-title" style={{ marginBottom: 0 }}>My Booking Chats</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="live-dot" />
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#10b981',
                  opacity: refreshing ? 1 : 0.55,
                  transition: 'opacity 0.3s',
                }}>LIVE</span>
              </div>
            </div>
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


                const matchedBooking = bookings.find(
                  (b) =>
                    b.username === session.username &&
                    b.date === ctx.date &&
                    b.time_slot === ctx.time_slot
                );


                const date        = ctx.date        || matchedBooking?.date        || null;
                const time_slot   = ctx.time_slot   || matchedBooking?.time_slot   || null;
                const patient_name = matchedBooking?.patient_name || ctx.patient_name || null;
                const problem      = matchedBooking?.problem      || ctx.problem      || null;

                const hasAny = date || time_slot || patient_name || problem;

                return (
                  <div
                    key={session.session_id}
                    className={`session-item-row ${activeSessionId === session.session_id ? 'active' : ''}`}
                    onClick={() => setActiveSessionId(session.session_id)}
                    style={{ flexDirection: 'column', alignItems: 'stretch', padding: '0.85rem', height: 'auto', gap: '0.5rem' }}
                  >
                    {/* Top row: icon + title + delete btn */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                        <MessageSquare size={13} style={{ flexShrink: 0, color: 'var(--primary)', opacity: 0.85 }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {date ? `${date}${time_slot ? ` @ ${time_slot}` : ''}` : 'New Booking Chat'}
                        </span>
                      </div>
                      <button
                        className="session-delete-btn"
                        onClick={(e) => handleDeleteSession(e, session.session_id)}
                        title="Delete Chat"
                        style={{ margin: 0, padding: '2px', flexShrink: 0 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Detail rows — only shown when booking context exists */}
                    {hasAny && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '0.25rem' }}>

                        {/* Date + Time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {date && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Calendar size={11} style={{ color: '#a5b4fc', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.74rem', color: '#a5b4fc', fontWeight: 600 }}>{date}</span>
                            </div>
                          )}
                          {time_slot && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock size={11} style={{ color: '#14b8a6', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.74rem', color: '#14b8a6', fontWeight: 600 }}>{time_slot}</span>
                            </div>
                          )}
                        </div>

                        {/* Patient name */}
                        {patient_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <User size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Patient: </span>
                              {patient_name}
                            </span>
                          </div>
                        )}

                        {/* Problem */}
                        {problem && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                            <FileText size={11} style={{ color: '#64748b', flexShrink: 0, marginTop: '1px' }} />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.35 }}>
                              "{problem}"
                            </span>
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
              <div className="profile-avatar" style={{ backgroundColor: 'var(--accent-teal)' }}>
                {user.charAt(0).toUpperCase()}
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
              Select a conversation or start a new booking chat.
            </div>
          )}
        </div>

        {/* Right Sidebar — Patient Bookings */}
        <aside className="bookings-column">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="slots-grid-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} /> My Bookings
            </h3>
            <button
              className="refresh-btn"
              onClick={() => {
                setRefreshing(true);
                if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = setTimeout(() => setRefreshing(false), 700);
                fetchBookingsList();
              }}
              disabled={loadingBookings}
              title="Refresh bookings"
            >
              <RefreshCw size={14} className={loadingBookings || refreshing ? 'spin' : ''} />
            </button>
          </div>

          <div className="bookings-list" style={{ flex: 1, overflowY: 'auto' }}>
            {loadingBookings && bookings.length === 0 ? (
              <div className="no-bookings">Loading bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="no-bookings">You have no confirmed bookings.</div>
            ) : (
              bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="patient-booking-card"
                >
                  {/* Confirmed badge */}
                  <div className="pbc-confirmed-badge">
                    <CheckCircle size={11} />
                    Confirmed
                  </div>

                  {/* Date & Time row */}
                  <div className="pbc-datetime-row">
                    <div className="pbc-date-pill">
                      <Calendar size={13} />
                      <span>{booking.date}</span>
                    </div>
                    <div className="pbc-time-pill">
                      <Clock size={12} />
                      <span>{booking.time_slot}</span>
                    </div>
                  </div>

                  {/* Patient name */}
                  <div className="pbc-info-row">
                    <User size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <span className="pbc-label">Patient:</span>
                    <span className="pbc-value">{booking.patient_name || 'Anonymous'}</span>
                  </div>

                  {/* Problem */}
                  {booking.problem && (
                    <div className="pbc-info-row" style={{ alignItems: 'flex-start' }}>
                      <FileText size={13} style={{ color: '#64748b', flexShrink: 0, marginTop: '1px' }} />
                      <span className="pbc-problem">"{booking.problem}"</span>
                    </div>
                  )}

                  {/* Cancel button */}
                  <button
                    className="pbc-cancel-btn"
                    onClick={() => handleCancelBooking(booking.id)}
                    title="Cancel Booking"
                  >
                    <Trash2 size={13} />
                    Cancel
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
