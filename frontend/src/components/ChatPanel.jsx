// import React, { useState, useEffect, useRef } from 'react';
// import { Sparkles, Send, ArrowRight } from 'lucide-react';
// import { sendChatMessage, getSessionDetail, cancelSessionBooking, acceptSessionBooking, rejectSessionBooking } from '../utils/api';

// function formatMessages(messagesList, userRole) {
//   return (messagesList || [])
//     .filter(m => m.role !== 'system' && m.role !== 'tool' && m.content && m.content.trim() !== '')
//     .map((m, idx) => {
//       let content = m.content;
//       if (userRole === 'doctor') {
//         if (content.includes("Your appointment has been rejected by the Doctor.") ||
//             content.includes("Your appointment has been cancelled by the Doctor.")) {
//           content = "Your appointment has been cancelled.";
//         }
//       }
//       return {
//         id: `msg-${idx}-${m.role}`,
//         role: m.role,
//         content: content,
//         isDoctorMessage: m.is_doctor || false,
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//       };
//     });
// }

// export default function ChatPanel({ sessionId, username, onBookingConfirmed }) {
//   const [messages, setMessages] = useState([]);
//   const [inputValue, setInputValue] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [bookingContext, setBookingContext] = useState({});
//   const [alertBanner, setAlertBanner] = useState(null);
//   const messagesListRef = useRef(null);
//   const prevMessagesCountRef = useRef(0);
//   const loadingRef = useRef(loading);

//   useEffect(() => {
//     loadingRef.current = loading;
//   }, [loading]);

//   const userRole = localStorage.getItem('medsync_role') || 'patient';


//   useEffect(() => {
//     if (!sessionId) return;

//     async function loadHistory(showLoading = false) {
//       if (loadingRef.current && !showLoading) {
//         return;
//       }
//       if (showLoading) setLoading(true);
//       try {
//         const data = await getSessionDetail(sessionId);
//         const formatted = formatMessages(data.messages, userRole);
//         setMessages(formatted);
//         setBookingContext(data.booking_context || {});
//       } catch (err) {
//         console.error('Failed to load history:', err);
//         if (showLoading) {
//           setMessages([
//             {
//               id: 'err-load',
//               role: 'assistant',
//               content: 'Failed to load conversation history. Please try again.',
//               time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//             },
//           ]);
//         }
//       } finally {
//         if (showLoading) setLoading(false);
//       }
//     }

//     loadHistory(true);

//     const interval = setInterval(() => {
//       loadHistory(false);
//     }, 4000);

//     return () => clearInterval(interval);
//   }, [sessionId, userRole]);

//   useEffect(() => {
//     console.log("ChatPanel debug:", { sessionId, bookingContext, userRole, loading });
//   }, [sessionId, bookingContext, userRole, loading]);

//   // Auto-scroll to bottom of messages
//   useEffect(() => {
//     if (messagesListRef.current) {
//       const prevCount = prevMessagesCountRef.current;
//       const currentCount = messages.length;
//       prevMessagesCountRef.current = currentCount;


//       if (currentCount > prevCount || loading) {
//         messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
//       }
//     }
//   }, [messages, loading]);

//   useEffect(() => {
//     if (messages.length === 0) {
//       setAlertBanner(null);
//       return;
//     }
    
//     const lastMsg = messages[messages.length - 1];
//     if (lastMsg.role === 'assistant') {
//       const content = lastMsg.content || '';
      
//       if (userRole === 'patient') {
//         if (content.includes("rejected by the Doctor")) {
//           setAlertBanner({ type: 'error', message: "Your appointment has been rejected." });
//           const alertKey = `alerted_reject_${sessionId}_${messages.length}`;
//           if (!localStorage.getItem(alertKey)) {
//             localStorage.setItem(alertKey, 'true');
//             alert("Your appointment has been rejected.");
//           }
//         } else if (content.includes("cancelled by the Doctor")) {
//           setAlertBanner({ type: 'error', message: "Your appointment has been cancelled by the Doctor." });
//           const alertKey = `alerted_cancel_${sessionId}_${messages.length}`;
//           if (!localStorage.getItem(alertKey)) {
//             localStorage.setItem(alertKey, 'true');
//             alert("Your appointment has been cancelled by the Doctor.");
//           }
//         } else if (content.includes("accepted/confirmed by the Doctor")) {
//           setAlertBanner({ type: 'success', message: "Your appointment has been accepted." });
//           const alertKey = `alerted_accept_${sessionId}_${messages.length}`;
//           if (!localStorage.getItem(alertKey)) {
//             localStorage.setItem(alertKey, 'true');
//             alert("Your appointment has been accepted.");
//           }
//         } else if (content.includes("Your appointment has been cancelled.")) {
//           setAlertBanner({ type: 'error', message: "Your appointment has been cancelled." });
//         } else {
//           setAlertBanner(null);
//         }
//       } else if (userRole === 'doctor') {
//         if (content.includes("Your appointment has been cancelled.") && !content.includes("by the Doctor")) {
//           setAlertBanner({ type: 'error', message: "Patient has cancelled this appointment." });
//           const alertKey = `alerted_cancel_${sessionId}_${messages.length}`;
//           if (!localStorage.getItem(alertKey)) {
//             localStorage.setItem(alertKey, 'true');
//             alert("Patient has cancelled this appointment.");
//           }
//         } else {
//           setAlertBanner(null);
//         }
//       }
//     } else {
//       setAlertBanner(null);
//     }
//   }, [messages, sessionId, userRole]);

//   const handleSend = async (textToSend) => {
//     const text = (textToSend || inputValue).trim();
//     if (!text) return;

//     if (!textToSend) {
//       setInputValue('');
//     }

//     const isDoc = userRole === 'doctor';
//     const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//     const newMsg = {
//       id: `msg-${Date.now()}-${isDoc ? 'assistant' : 'user'}`,
//       role: isDoc ? 'assistant' : 'user',
//       content: text,
//       isDoctorMessage: isDoc,
//       time: msgTime,
//     };

//     setMessages((prev) => [...prev, newMsg]);
//     setLoading(true);

//     try {
//       const data = await sendChatMessage(text, sessionId, username, isDoc);
      
//       if (!isDoc) {
//         const assistantTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//         const assistantMsg = {
//           id: `msg-${Date.now()}-assistant`,
//           role: 'assistant',
//           content: data.reply,
//           isDoctorMessage: false,
//           time: assistantTime,
//         };
//         setMessages((prev) => [...prev, assistantMsg]);
//       }


//       if (onBookingConfirmed) {
//         onBookingConfirmed();
//       }
//     } catch (err) {
//       console.error(err);
//       const errorMsg = {
//         id: `msg-${Date.now()}-err`,
//         role: 'assistant',
//         content: "I'm sorry, I ran into an error communicating with the booking database. Please check that the server and model are running.",
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//       };
//       setMessages((prev) => [...prev, errorMsg]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleManualCancel = async () => {
//     if (!window.confirm('Are you sure you want to cancel this booking slot manually?')) {
//       return;
//     }
//     setLoading(true);
//     try {
//       const updatedSession = await cancelSessionBooking(sessionId);
//       setBookingContext(updatedSession.booking_context || {});
      
// le
//       const data = await getSessionDetail(sessionId);
//       const formatted = formatMessages(data.messages, userRole);
//       setMessages(formatted);
      
//       if (onBookingConfirmed) {
//         onBookingConfirmed();
//       }
//     } catch (err) {
//       alert('Failed to cancel appointment: ' + err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleRejectBooking = async () => {
//     if (!window.confirm('Are you sure you want to reject this appointment?')) {
//       return;
//     }
//     setLoading(true);
//     try {
//       const updatedSession = await rejectSessionBooking(sessionId);
//       setBookingContext(updatedSession.booking_context || {});

//       const data = await getSessionDetail(sessionId);
//       const formatted = formatMessages(data.messages, userRole);
//       setMessages(formatted);
      
//       if (onBookingConfirmed) {
//         onBookingConfirmed();
//       }
//     } catch (err) {
//       alert('Failed to reject appointment: ' + err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleAcceptBooking = async () => {
//     if (!window.confirm('Are you sure you want to accept this appointment?')) {
//       return;
//     }
//     setLoading(true);
//     try {
//       const updatedSession = await acceptSessionBooking(sessionId);
//       setBookingContext(updatedSession.booking_context || {});
      
// bble
//       const data = await getSessionDetail(sessionId);
//       const formatted = formatMessages(data.messages, userRole);
//       setMessages(formatted);
      
//       if (onBookingConfirmed) {
//         onBookingConfirmed();
//       }
//     } catch (err) {
//       alert('Failed to accept appointment: ' + err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleQuickOption = (text) => {
//     handleSend(text);
//   };

//   const quickPrompts = [
//     'I want to book an appointment',
//     'Show available slots for tomorrow',
//     'Book next Monday at 10:00',
//   ];

//   return (
//     <div className="glass-panel chat-panel" style={{ height: '100%', position: 'relative' }}>
//       <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
//           <div className="avatar-wrapper">
//             <Sparkles size={20} />
//           </div>
//           <div className="chat-header-info">
//             <h2>{userRole === 'doctor' ? 'Doctor Patient Console' : 'Clinic Booking Assistant'}</h2>
//             <p>
//               {userRole === 'doctor'
//                 ? bookingContext.patient_name
//                   ? `Patient: ${bookingContext.patient_name}${bookingContext.problem ? ` — ${bookingContext.problem}` : ''}`
//                   : `Viewing session`
//                 : `Logged in as ${username} (Patient)`}
//             </p>
//           </div>
//         </div>

//         {/* Manual Cancel Button for Patient within Chat Header */}
//         {userRole === 'patient' && bookingContext.date && bookingContext.time_slot && (
//           <button 
//             type="button" 
//             className="cancel-btn"
//             style={{ 
//               backgroundColor: 'var(--color-booked)', 
//               color: 'white', 
//               padding: '0.5rem 0.85rem', 
//               fontSize: '0.8rem',
//               borderRadius: 'var(--radius-sm)',
//               border: 'none',
//               cursor: 'pointer',
//               fontWeight: '600'
//             }}
//             onClick={handleManualCancel}
//             disabled={loading}
//           >
//             Cancel Booking
//           </button>
//         )}
//       </div>
//       {alertBanner && (
//         <div style={{
//           position: 'absolute',
//           top: '4.5rem',
//           left: '50%',
//           transform: 'translateX(-50%)',
//           zIndex: 50,
//           background: alertBanner.type === 'success' ? '#10b981' : '#ef4444',
//           color: 'white',
//           padding: '0.75rem 1.5rem',
//           borderRadius: 'var(--radius-md)',
//           boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
//           fontWeight: '600',
//           fontSize: '0.88rem',
//           textAlign: 'center',
//           animation: 'slideUp 0.3s ease-out',
//           width: '90%',
//           maxWidth: '360px',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'center'
//         }}>
//           {alertBanner.message}
//         </div>
//       )}

//       <div className="messages-list" ref={messagesListRef}>
//         {messages.map((msg) => {
//           if (msg.isDoctorMessage) {
//             // Render Doctor message in a special small distinct box
//             return (
//               <div key={msg.id} className="message-bubble assistant" style={{
//                 border: '1px solid var(--accent-teal)',
//                 background: 'rgba(20, 184, 166, 0.05)',
//                 position: 'relative',
//                 paddingTop: '1.25rem',
//                 borderBottomLeftRadius: '2px'
//               }}>
//                 <div style={{
//                   position: 'absolute',
//                   top: '4px',
//                   left: '12px',
//                   fontSize: '0.65rem',
//                   fontWeight: 'bold',
//                   color: 'var(--accent-teal)',
//                   textTransform: 'uppercase',
//                   letterSpacing: '0.5px'
//                 }}>
//                   Doctor Response
//                 </div>
//                 <div className="message-text">{msg.content}</div>
//                 <div className="message-time">{msg.time}</div>
//               </div>
//             );
//           }
          
//           return (
//             <div key={msg.id} className={`message-bubble ${msg.role}`}>
//               <div className="message-text">{msg.content}</div>
//               <div className="message-time">{msg.time}</div>
//             </div>
//           );
//         })}
//         {loading && (
//           <div className="typing-indicator" title="Assistant is thinking...">
//             <div className="typing-dot"></div>
//             <div className="typing-dot"></div>
//             <div className="typing-dot"></div>
//           </div>
//         )}
//         {/* Scroll anchor is now handled directly on messages-list container ref */}
//       </div>

//       {messages.length <= 1 && !loading && userRole === 'patient' && (
//         <div className="quick-options">
//           {quickPrompts.map((prompt, index) => (
//             <button
//               key={index}
//               className="quick-btn"
//               onClick={() => handleQuickOption(prompt)}
//             >
//               {prompt} <ArrowRight size={12} style={{ marginLeft: '4px', display: 'inline' }} />
//             </button>
//           ))}
//         </div>
//       )}

//       {userRole === 'doctor' ? (
//         <div style={{
//           display: 'flex',
//           flexDirection: 'column',
//           gap: '0.75rem',
//           padding: '1.25rem 1.5rem',
//           background: 'rgba(255, 255, 255, 0.01)',
//           borderTop: '1px solid var(--border-color)',
//           width: '100%'
//         }}>
//           {/* Doctor booking action buttons */}
//           {bookingContext.date && bookingContext.time_slot ? (
//             <div style={{ display: 'flex', gap: '0.75rem' }}>
//               <button
//                 type="button"
//                 style={{
//                   flex: 1,
//                   backgroundColor: '#10b981',
//                   color: 'white',
//                   border: 'none',
//                   padding: '0.75rem 1rem',
//                   borderRadius: 'var(--radius-md)',
//                   cursor: loading ? 'not-allowed' : 'pointer',
//                   fontWeight: '600',
//                   fontSize: '0.9rem',
//                   opacity: loading ? 0.6 : 1,
//                   transition: 'all 0.2s ease',
//                 }}
//                 onClick={handleAcceptBooking}
//                 disabled={loading}
//               >
//                 ✓ Accept Booking
//               </button>
//               <button
//                 type="button"
//                 style={{
//                   flex: 1,
//                   backgroundColor: 'var(--color-booked)',
//                   color: 'white',
//                   border: 'none',
//                   padding: '0.75rem 1rem',
//                   borderRadius: 'var(--radius-md)',
//                   cursor: loading ? 'not-allowed' : 'pointer',
//                   fontWeight: '600',
//                   fontSize: '0.9rem',
//                   opacity: loading ? 0.6 : 1,
//                   transition: 'all 0.2s ease',
//                 }}
//                 onClick={handleRejectBooking}
//                 disabled={loading}
//               >
//                 ✗ Reject Booking
//               </button>
//             </div>
//           ) : (
//             <div style={{
//               textAlign: 'center',
//               fontSize: '0.8rem',
//               color: 'var(--text-muted)',
//               padding: '0.4rem 0',
//               fontStyle: 'italic',
//             }}>
//               No active booking to action — patient is still in conversation
//             </div>
//           )}

//           {/* Doctor message input */}
//           <form
//             style={{ display: 'flex', gap: '0.5rem' }}
//             onSubmit={(e) => { e.preventDefault(); handleSend(); }}
//           >
//             <input
//               type="text"
//               className="chat-input"
//               placeholder="Send a message to the patient..."
//               value={inputValue}
//               onChange={(e) => setInputValue(e.target.value)}
//               disabled={loading}
//               style={{ fontSize: '0.88rem' }}
//             />
//             <button
//               type="submit"
//               className="send-button"
//               disabled={loading || !inputValue.trim()}
//             >
//               <Send size={18} />
//             </button>
//           </form>
//         </div>
//       ) : (
//         <form
//           className="chat-input-form"
//           onSubmit={(e) => {
//             e.preventDefault();
//             handleSend();
//           }}
//         >
//           <input
//             type="text"
//             className="chat-input"
//             placeholder="Type a message (e.g. 'tomorrow at 11:30' or 'cancel my slot')..."
//             value={inputValue}
//             onChange={(e) => setInputValue(e.target.value)}
//             disabled={loading}
//           />
//           <button
//             type="submit"
//             className="send-button"
//             disabled={loading || !inputValue.trim()}
//           >
//             <Send size={18} />
//           </button>
//         </form>
//       )}
//     </div>
//   );
// }
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, ArrowRight, Bell } from 'lucide-react';
import { sendChatMessage, getSessionDetail, cancelSessionBooking, acceptSessionBooking, rejectSessionBooking } from '../utils/api';
import '../bell.css';

function formatMessages(messagesList, userRole) {
  return (messagesList || [])
    .filter(m => m.role !== 'system' && m.role !== 'tool' && m.content && m.content.trim() !== '')
    .map((m, idx) => {
      let content = m.content;
      if (userRole === 'doctor') {
        if (content.includes("Your appointment has been rejected by the Doctor.") ||
            content.includes("Your appointment has been cancelled by the Doctor.")) {
          content = "Your appointment has been cancelled.";
        }
      }
      return {
        id: `msg-${idx}-${m.role}`,
        role: m.role,
        content: content,
        isDoctorMessage: m.is_doctor || false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });
}

export default function ChatPanel({ sessionId, username, onBookingConfirmed }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookingContext, setBookingContext] = useState({});
  const [alertBanner, setAlertBanner] = useState(null);

  // Bell notification state: a running list of notices (currently just
  // doctor-initiated cancellations) plus whether there's an unread one.
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem(`medsync_notifs_${username}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const hasUnread = notifications.some((n) => !n.read);

  // Sync notifications to localStorage
  useEffect(() => {
    localStorage.setItem(`medsync_notifs_${username}`, JSON.stringify(notifications));
  }, [notifications, username]);

  const messagesListRef = useRef(null);
  const prevMessagesCountRef = useRef(0);
  const loadingRef = useRef(loading);
  const notifDropdownRef = useRef(null);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const userRole = localStorage.getItem('medsync_role') || 'patient';


  useEffect(() => {
    if (!sessionId) return;

    async function loadHistory(showLoading = false) {
      if (loadingRef.current && !showLoading) {
        return;
      }
      if (showLoading) setLoading(true);
      try {
        const data = await getSessionDetail(sessionId);
        const formatted = formatMessages(data.messages, userRole);
        setMessages(formatted);
        setBookingContext(data.booking_context || {});
      } catch (err) {
        console.error('Failed to load history:', err);
        if (showLoading) {
          setMessages([
            {
              id: 'err-load',
              role: 'assistant',
              content: 'Failed to load conversation history. Please try again.',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    }

    loadHistory(true);

    const interval = setInterval(() => {
      loadHistory(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [sessionId, userRole]);

  useEffect(() => {
    console.log("ChatPanel debug:", { sessionId, bookingContext, userRole, loading });
  }, [sessionId, bookingContext, userRole, loading]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesListRef.current) {
      const prevCount = prevMessagesCountRef.current;
      const currentCount = messages.length;
      prevMessagesCountRef.current = currentCount;


      if (currentCount > prevCount || loading) {
        messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
      }
    }
  }, [messages, loading]);

  // Close the notification dropdown when clicking outside of it.
  useEffect(() => {
    if (!showNotifications) return;
    function handleClickOutside(e) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Listen for global notification updates
  useEffect(() => {
    function handleNotifsUpdated() {
      try {
        const stored = localStorage.getItem(`medsync_notifs_${username}`);
        if (stored) {
          setNotifications(JSON.parse(stored));
        }
      } catch (e) {
        console.error(e);
      }
    }
    window.addEventListener('medsync_notifs_updated', handleNotifsUpdated);
    return () => window.removeEventListener('medsync_notifs_updated', handleNotifsUpdated);
  }, [username]);

  useEffect(() => {
    if (messages.length === 0) {
      setAlertBanner(null);
      return;
    }
    
    if (userRole === 'patient') {
      // 1. Alert Banner based on last message
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        const content = lastMsg.content || '';
        
        if (content.includes("rejected by the Doctor")) {
          setAlertBanner({ type: 'error', message: "Your appointment has been rejected." });
        } else if (content.includes("cancelled by the Doctor")) {
          setAlertBanner({ type: 'error', message: "Your appointment has been cancelled by the Doctor." });
        } else if (content.includes("accepted/confirmed by the Doctor")) {
          setAlertBanner({ type: 'success', message: "Your appointment has been accepted." });
        } else if (content.includes("Your appointment has been cancelled.")) {
          setAlertBanner({ type: 'error', message: "Your appointment has been cancelled." });
        } else {
          setAlertBanner(null);
        }
      } else {
        setAlertBanner(null);
      }

      // 2. Bell notification scanner: Scan all messages for cancellations
      const docCancellations = messages.filter(
        (m) => m.role === 'assistant' && m.content.includes("cancelled by the Doctor")
      );

      if (docCancellations.length > 0) {
        setNotifications((prev) => {
          let updated = false;
          const nextNotifs = [...prev];
          docCancellations.forEach((msg, idx) => {
            const notifId = `notif-${sessionId}-${idx}`;
            if (!nextNotifs.some((n) => n.id === notifId)) {
              nextNotifs.unshift({
                id: notifId,
                message: 'Your appointment has been cancelled by the Doctor.',
                time: msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: false,
              });
              updated = true;
            }
          });
          return updated ? nextNotifs : prev;
        });
      }
    } else if (userRole === 'doctor') {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        const content = lastMsg.content || '';
        if (content.includes("Your appointment has been cancelled.") && !content.includes("by the Doctor")) {
          setAlertBanner({ type: 'error', message: "Patient has cancelled this appointment." });
        } else {
          setAlertBanner(null);
        }
      }
    }
  }, [messages, sessionId, userRole]);

  const handleBellClick = () => {
    setShowNotifications((prev) => !prev);
    // Mark all as read once the dropdown is opened.
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    if (!textToSend) {
      setInputValue('');
    }

    const isDoc = userRole === 'doctor';
    const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: `msg-${Date.now()}-${isDoc ? 'assistant' : 'user'}`,
      role: isDoc ? 'assistant' : 'user',
      content: text,
      isDoctorMessage: isDoc,
      time: msgTime,
    };

    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);

    try {
      const data = await sendChatMessage(text, sessionId, username, isDoc);
      
      if (!isDoc) {
        const assistantTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const assistantMsg = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.reply,
          isDoctorMessage: false,
          time: assistantTime,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }


      if (onBookingConfirmed) {
        onBookingConfirmed();
      }
    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: "I'm sorry, I ran into an error communicating with the booking database. Please check that the server and model are running.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking slot manually?')) {
      return;
    }
    setLoading(true);
    try {
      const updatedSession = await cancelSessionBooking(sessionId);
      setBookingContext(updatedSession.booking_context || {});

      const data = await getSessionDetail(sessionId);
      const formatted = formatMessages(data.messages, userRole);
      setMessages(formatted);
      
      if (onBookingConfirmed) {
        onBookingConfirmed();
      }
    } catch (err) {
      alert('Failed to cancel appointment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectBooking = async () => {
    if (!window.confirm('Are you sure you want to reject this appointment?')) {
      return;
    }
    setLoading(true);
    try {
      const updatedSession = await rejectSessionBooking(sessionId);
      setBookingContext(updatedSession.booking_context || {});

      const data = await getSessionDetail(sessionId);
      const formatted = formatMessages(data.messages, userRole);
      setMessages(formatted);
      
      if (onBookingConfirmed) {
        onBookingConfirmed();
      }
    } catch (err) {
      alert('Failed to reject appointment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBooking = async () => {
    if (!window.confirm('Are you sure you want to accept this appointment?')) {
      return;
    }
    setLoading(true);
    try {
      const updatedSession = await acceptSessionBooking(sessionId);
      setBookingContext(updatedSession.booking_context || {});

      const data = await getSessionDetail(sessionId);
      const formatted = formatMessages(data.messages, userRole);
      setMessages(formatted);
      
      if (onBookingConfirmed) {
        onBookingConfirmed();
      }
    } catch (err) {
      alert('Failed to accept appointment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickOption = (text) => {
    handleSend(text);
  };

  const quickPrompts = [
    'I want to book an appointment',
    'Show available slots for tomorrow',
    'Book next Monday at 10:00',
  ];

  return (
    <div className="glass-panel chat-panel" style={{ height: '100%', position: 'relative' }}>
      <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="avatar-wrapper">
            <Sparkles size={20} />
          </div>
          <div className="chat-header-info">
            <h2>{userRole === 'doctor' ? 'Doctor Patient Console' : 'Clinic Booking Assistant'}</h2>
            <p>
              {userRole === 'doctor'
                ? bookingContext.patient_name
                  ? `Patient: ${bookingContext.patient_name}${bookingContext.problem ? ` — ${bookingContext.problem}` : ''}`
                  : `Viewing session`
                : `Logged in as ${username} (Patient)`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Notification bell (patient view) -- lights up red when the
              doctor cancels this booking. */}
          {userRole === 'patient' && (
            <div 
              className="notif-bell-wrapper" 
              ref={notifDropdownRef}
              onMouseEnter={() => {
                setShowNotifications(true);
                // Mark all notifications as read when hovered
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
              }}
              onMouseLeave={() => setShowNotifications(false)}
            >
              <button
                type="button"
                className={`notif-bell-btn ${hasUnread ? 'notif-bell-active' : ''}`}
                onClick={handleBellClick}
                title="Notifications"
              >
                <Bell size={18} />
                {hasUnread && <span className="notif-bell-dot" />}
              </button>

              {showNotifications && (
                <div className="notif-dropdown">
                  {notifications.length === 0 ? (
                    <div className="notif-dropdown-empty">No notifications yet.</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="notif-dropdown-item">
                        <span className="notif-dropdown-message">{n.message}</span>
                        <span className="notif-dropdown-time">{n.time}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Cancel Button for Patient within Chat Header */}
          {userRole === 'patient' && bookingContext.date && bookingContext.time_slot && (
            <button
              type="button"
              className="cancel-btn"
              style={{
                backgroundColor: 'var(--color-booked)',
                color: 'white',
                padding: '0.5rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
              onClick={handleManualCancel}
              disabled={loading}
            >
              Cancel Booking
            </button>
          )}
        </div>
      </div>
      {alertBanner && (
        <div style={{
          position: 'absolute',
          top: '4.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: alertBanner.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          fontWeight: '600',
          fontSize: '0.88rem',
          textAlign: 'center',
          animation: 'slideUp 0.3s ease-out',
          width: '90%',
          maxWidth: '360px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {alertBanner.message}
        </div>
      )}

      <div className="messages-list" ref={messagesListRef}>
        {messages.map((msg) => {
          if (msg.isDoctorMessage) {
            // Render Doctor message in a special small distinct box
            return (
              <div key={msg.id} className="message-bubble assistant" style={{
                border: '1px solid var(--accent-teal)',
                background: 'rgba(20, 184, 166, 0.05)',
                position: 'relative',
                paddingTop: '1.25rem',
                borderBottomLeftRadius: '2px'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  left: '12px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  color: 'var(--accent-teal)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Doctor Response
                </div>
                <div className="message-text">{msg.content}</div>
                <div className="message-time">{msg.time}</div>
              </div>
            );
          }
          
          return (
            <div key={msg.id} className={`message-bubble ${msg.role}`}>
              <div className="message-text">{msg.content}</div>
              <div className="message-time">{msg.time}</div>
            </div>
          );
        })}
        {loading && (
          <div className="typing-indicator" title="Assistant is thinking...">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
        {/* Scroll anchor is now handled directly on messages-list container ref */}
      </div>

      {messages.length <= 1 && !loading && userRole === 'patient' && (
        <div className="quick-options">
          {quickPrompts.map((prompt, index) => (
            <button
              key={index}
              className="quick-btn"
              onClick={() => handleQuickOption(prompt)}
            >
              {prompt} <ArrowRight size={12} style={{ marginLeft: '4px', display: 'inline' }} />
            </button>
          ))}
        </div>
      )}

      {userRole === 'doctor' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1.25rem 1.5rem',
          background: 'rgba(255, 255, 255, 0.01)',
          borderTop: '1px solid var(--border-color)',
          width: '100%'
        }}>
          {/* Doctor booking action buttons */}
          {bookingContext.date && bookingContext.time_slot ? (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={handleAcceptBooking}
                disabled={loading}
              >
                ✓ Accept Booking
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  backgroundColor: 'var(--color-booked)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={handleRejectBooking}
                disabled={loading}
              >
                ✗ Reject Booking
              </button>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              padding: '0.4rem 0',
              fontStyle: 'italic',
            }}>
              No active booking to action — patient is still in conversation
            </div>
          )}

          {/* Doctor message input */}
          <form
            style={{ display: 'flex', gap: '0.5rem' }}
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          >
            <input
              type="text"
              className="chat-input"
              placeholder="Send a message to the patient..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              style={{ fontSize: '0.88rem' }}
            />
            <button
              type="submit"
              className="send-button"
              disabled={loading || !inputValue.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <form
          className="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message (e.g. 'tomorrow at 11:30' or 'cancel my slot')..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="send-button"
            disabled={loading || !inputValue.trim()}
          >
            <Send size={18} />
          </button>
        </form>
      )}
    </div>
  );
}