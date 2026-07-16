import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  User,
  FileText,
  RefreshCw,
  Trash2,
  Stethoscope,
  AlertCircle,
  Lock,
  Unlock,
  ChevronRight,
} from 'lucide-react';
import { cancelBooking, blockSlot, getSlots, getBookingsByDate } from '../utils/api';



function SlotBlocker({ onSlotsChanged }) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState([]);
  const [dateBookings, setDateBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionSlot, setActionSlot] = useState(null);
  const [error, setError] = useState(null);

  const fetchForDate = useCallback(async (date) => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const [slotsResp, bookingsResp] = await Promise.all([
        getSlots(date),
        getBookingsByDate(date),
      ]);
      setSlots(slotsResp.slots || []);
      setDateBookings(bookingsResp || []);
    } catch (err) {
      setError(err.message);
      setSlots([]);
      setDateBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForDate(selectedDate);
  }, [selectedDate, fetchForDate]);


  const isBlockedByDoctor = (timeSlot) =>
    dateBookings.some(
      (b) => b.time_slot === timeSlot && b.patient_name === '__BLOCKED__'
    );


  const isPatientBooked = (timeSlot) =>
    dateBookings.some(
      (b) => b.time_slot === timeSlot && b.patient_name !== '__BLOCKED__'
    );

  const getBlockedBookingId = (timeSlot) => {
    const b = dateBookings.find(
      (bk) => bk.time_slot === timeSlot && bk.patient_name === '__BLOCKED__'
    );
    return b ? b.id : null;
  };

  const handleToggleBlock = async (slot) => {
    setActionSlot(slot.time_slot);
    try {
      if (isBlockedByDoctor(slot.time_slot)) {

        const bid = getBlockedBookingId(slot.time_slot);
        if (bid) await cancelBooking(bid, 'doctor');
      } else {

        await blockSlot(selectedDate, slot.time_slot);
      }

      await fetchForDate(selectedDate);
      if (onSlotsChanged) onSlotsChanged();
    } catch (err) {
      alert('Action failed: ' + err.message);
    } finally {
      setActionSlot(null);
    }
  };

  return (
    <div className="slot-blocker-panel">
      <div className="slot-blocker-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="slot-blocker-icon">
            <Lock size={16} />
          </div>
          <div>
            <div className="slot-blocker-title">Slot Manager</div>
            <div className="slot-blocker-subtitle">Block / unblock time slots for patients</div>
          </div>
        </div>
        <button
          className="refresh-btn"
          onClick={() => fetchForDate(selectedDate)}
          disabled={loading}
          title="Refresh slots"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Date picker */}
      <div className="slot-blocker-datepicker-row">
        <Calendar size={15} style={{ color: '#a5b4fc' }} />
        <input
          type="date"
          className="custom-datepicker"
          value={selectedDate}
          min={today}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ flex: 1 }}
        />
        {selectedDate && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'short', day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Slots grid */}
      {error ? (
        <div style={{ textAlign: 'center', color: 'var(--color-booked)', fontSize: '0.82rem', padding: '1rem' }}>
          {error}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem', fontSize: '0.85rem' }}>
          <RefreshCw size={18} className="spin" style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.5 }} />
          Loading slots…
        </div>
      ) : slots.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem', fontSize: '0.85rem' }}>
          No slots available for this date.
        </div>
      ) : (
        <div className="slot-blocker-grid">
          {slots.map((slot) => {
            const blocked = isBlockedByDoctor(slot.time_slot);
            const patientBooked = isPatientBooked(slot.time_slot);
            const isActioning = actionSlot === slot.time_slot;

            let stateClass = 'slot-free';
            let stateLabel = 'Available';
            if (blocked) { stateClass = 'slot-blocked'; stateLabel = 'Blocked'; }
            else if (patientBooked) { stateClass = 'slot-patient'; stateLabel = 'Booked'; }

            return (
              <div key={slot.time_slot} className={`slot-blocker-cell ${stateClass}`}>
                <div className="slot-blocker-cell-time">
                  <Clock size={11} />
                  {slot.time_slot}
                </div>
                <div className="slot-blocker-cell-label">{stateLabel}</div>
                {/* Only allow block/unblock if not a real patient booking */}
                {!patientBooked && (
                  <button
                    className={`slot-toggle-btn ${blocked ? 'slot-toggle-unblock' : 'slot-toggle-block'}`}
                    onClick={() => handleToggleBlock(slot)}
                    disabled={isActioning}
                    title={blocked ? 'Unblock this slot' : 'Block this slot'}
                  >
                    {isActioning ? (
                      <RefreshCw size={10} className="spin" />
                    ) : blocked ? (
                      <><Unlock size={10} /> Unblock</>
                    ) : (
                      <><Lock size={10} /> Block</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="slot-blocker-legend">
        <div className="legend-item"><span className="legend-dot free" />Available</div>
        <div className="legend-item"><span className="legend-dot blocked" />Blocked by you</div>
        <div className="legend-item"><span className="legend-dot patient" />Patient booked</div>
      </div>
    </div>
  );
}



export default function DoctorDashboard({ bookings, loadingBookings, onRefresh, refreshing }) {
  const [actionLoading, setActionLoading] = useState(null);

  // Only show real patient bookings (exclude __BLOCKED__ entries)
  const realBookings = bookings.filter((b) => b.patient_name !== '__BLOCKED__');

  const handleCancel = async (booking) => {
    if (!window.confirm(`Cancel booking for ${booking.patient_name || booking.username} on ${booking.date} @ ${booking.time_slot}?`)) return;
    setActionLoading(booking.id);
    try {
      await cancelBooking(booking.id, 'doctor');
      onRefresh();
    } catch (err) {
      alert('Failed to cancel: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const total = realBookings.length;

  return (
    <div className="doctor-dashboard">

      {/* ── Header ── */}
      <div className="doctor-dash-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="doctor-dash-icon">
            <Stethoscope size={22} />
          </div>
          <div>
            <h2 className="doctor-dash-title">Clinic Dashboard</h2>
            <p className="doctor-dash-subtitle">Manage appointments & block slots</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* LIVE indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="live-dot" />
            <span style={{
              fontSize: '0.62rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: '#10b981',
              opacity: refreshing ? 1 : 0.6,
              transition: 'opacity 0.3s',
            }}>LIVE</span>
          </div>
          <button className="refresh-btn" onClick={onRefresh} disabled={loadingBookings} title="Refresh">
            <RefreshCw size={16} className={loadingBookings || refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="doctor-main-grid">

        {/* LEFT: Slot Blocker Calendar */}
        <SlotBlocker onSlotsChanged={onRefresh} />

        {/* RIGHT: Booking List */}
        <div className="doctor-bookings-column">

          {/* Stats */}
          <div className="doctor-stats-row" style={{ marginBottom: '1rem' }}>
            <div className="doctor-stat-card">
              <div className="doctor-stat-val" style={{ color: '#a5b4fc' }}>{total}</div>
              <div className="doctor-stat-label">Total Bookings</div>
            </div>
          </div>

          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}>
            <ChevronRight size={16} style={{ color: 'var(--primary)' }} />
            Patient Bookings
          </h3>

          <div className="doctor-bookings-list">
            {loadingBookings && realBookings.length === 0 ? (
              <div className="no-bookings">
                <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                Loading appointments…
              </div>
            ) : realBookings.length === 0 ? (
              <div className="no-bookings">
                <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
                No patient bookings yet.
              </div>
            ) : (
              realBookings.map((booking) => {
                const isActioning = actionLoading === booking.id;
                return (
                  <div
                    key={booking.id}
                    className="doctor-booking-card"
                    style={{ opacity: isActioning ? 0.6 : 1 }}
                  >
                    {/* Date + Time */}
                    <div className="dbc-top-row">
                      <div className="dbc-datetime">
                        <div className="dbc-date">
                          <Calendar size={13} style={{ color: '#a5b4fc', flexShrink: 0 }} />
                          <span>{booking.date}</span>
                        </div>
                        <div className="dbc-time">
                          <Clock size={12} style={{ color: '#14b8a6', flexShrink: 0 }} />
                          <span>{booking.time_slot}</span>
                        </div>
                      </div>
                    </div>

                    {/* Patient */}
                    <div className="dbc-patient-row">
                      <User size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <span className="dbc-patient-name">{booking.patient_name || 'Anonymous'}</span>
                      <span className="dbc-username">(@{booking.username || 'guest'})</span>
                    </div>

                    {/* Problem */}
                    {booking.problem && (
                      <div className="dbc-problem-row">
                        <FileText size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span className="dbc-problem-text">"{booking.problem}"</span>
                      </div>
                    )}

                    {/* Only Cancel — no Accept/Reject */}
                    <div className="dbc-actions">
                      <button
                        className="dbc-btn dbc-btn-cancel"
                        onClick={() => handleCancel(booking)}
                        disabled={isActioning}
                        title="Cancel Booking"
                      >
                        <Trash2 size={13} />
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
