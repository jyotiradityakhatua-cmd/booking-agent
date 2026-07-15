const BASE_URL = 'http://localhost:8000';

export async function login(username, password) {
  const resp = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.detail || 'Login failed');
  }
  return resp.json();
}

export async function signup(username, password) {
  const resp = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.detail || 'Signup failed');
  }
  return resp.json();
}

export async function getSessions(username = '') {
  let url = `${BASE_URL}/sessions`;
  if (username) {
    url += `?username=${encodeURIComponent(username)}`;
  }
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Failed to fetch past chats');
  }
  return resp.json();
}

export async function deleteSession(sessionId) {
  const resp = await fetch(`${BASE_URL}/session/${sessionId}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    throw new Error('Failed to delete chat');
  }
  return resp.json();
}

export async function startSession(username) {
  const resp = await fetch(`${BASE_URL}/session?username=${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp.ok) {
    throw new Error('Failed to start session');
  }
  return resp.json(); // returns { session_id, greeting }
}

export async function sendChatMessage(message, sessionId, username, isDoctor = false) {
  const resp = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId, username, is_doctor: isDoctor }),
  });
  if (!resp.ok) {
    throw new Error('Failed to send message');
  }
  return resp.json(); // returns { session_id, reply }
}

export async function getSlots(dateStr) {
  const resp = await fetch(`${BASE_URL}/slots?date=${encodeURIComponent(dateStr)}`);
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch slots');
  }
  return resp.json(); // returns SlotsResponse
}

export async function getBookings(username = '') {
  let url = `${BASE_URL}/bookings`;
  if (username) {
    url += `?username=${encodeURIComponent(username)}`;
  }
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Failed to fetch bookings');
  }
  return resp.json(); // returns list of bookings
}

export async function cancelBooking(bookingId, role = 'patient') {
  const resp = await fetch(`${BASE_URL}/bookings/${bookingId}?role=${encodeURIComponent(role)}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to cancel booking');
  }
  return resp.json();
}

export async function getSessionDetail(sessionId) {
  const resp = await fetch(`${BASE_URL}/session/${sessionId}`);
  if (!resp.ok) {
    throw new Error('Failed to fetch chat history');
  }
  return resp.json();
}

export async function cancelSessionBooking(sessionId) {
  const resp = await fetch(`${BASE_URL}/session/${sessionId}/cancel`, {
    method: 'POST',
  });
  if (!resp.ok) {
    throw new Error('Failed to cancel session booking');
  }
  return resp.json();
}

export async function acceptSessionBooking(sessionId) {
  const resp = await fetch(`${BASE_URL}/session/${sessionId}/accept`, {
    method: 'POST',
  });
  if (!resp.ok) {
    throw new Error('Failed to accept session booking');
  }
  return resp.json();
}

export async function rejectSessionBooking(sessionId) {
  const resp = await fetch(`${BASE_URL}/session/${sessionId}/reject`, {
    method: 'POST',
  });
  if (!resp.ok) {
    throw new Error('Failed to reject session booking');
  }
  return resp.json();
}
