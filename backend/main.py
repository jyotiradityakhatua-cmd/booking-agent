import uuid
from datetime import date as date_type, datetime, time, timedelta

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import json
from database import get_conn, init_db
from schemas import (
    BookingRequest,
    BookingResponse,
    CancelResponse,
    SlotInfo,
    SlotsResponse,
    LoginRequest,
    SignupRequest,
    SessionInfo,
)
from agent_core import new_conversation, run_agent_turn


CLINIC_OPEN = time(9, 0)
CLINIC_CLOSE = time(17, 0)
LUNCH_START = time(13, 0)
LUNCH_END = time(14, 0)
SLOT_MINUTES = 30

app = FastAPI(
    title="Clinic Booking & Chat API",
    description="Combined backend engine and conversational agent for clinic booking.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


def generate_all_slots() -> list[str]:

    slots = []
    current = datetime.combine(date_type.today(), CLINIC_OPEN)
    end = datetime.combine(date_type.today(), CLINIC_CLOSE)
    lunch_start_dt = datetime.combine(date_type.today(), LUNCH_START)
    lunch_end_dt = datetime.combine(date_type.today(), LUNCH_END)

    while current < end:
        if not (lunch_start_dt <= current < lunch_end_dt):
            slots.append(current.strftime("%H:%M"))
        current += timedelta(minutes=SLOT_MINUTES)
    return slots


def validate_date_str(date_str: str) -> date_type:

    try:
        parsed = date_type.fromisoformat(str(date_str).strip())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Date must be normalized by the agent to YYYY-MM-DD before calling this endpoint.",
        )
    if parsed < date_type.today():
        raise HTTPException(status_code=400, detail="Cannot query or book a date in the past")
    return parsed



@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/slots", response_model=SlotsResponse)
def get_available_slots(
    response: Response,
    date: str = Query(
        ...,
        description=(
            "Date normalized by the agent in YYYY-MM-DD format."
        ),
    ),
):
    
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    normalized_date = validate_date_str(date).isoformat()
    all_slots = generate_all_slots()

    with get_conn() as conn:
        rows = conn.execute(
            "SELECT time_slot FROM bookings WHERE date = ?", (normalized_date,)
        ).fetchall()
    booked = {r["time_slot"] for r in rows}

    now = datetime.now()
    current_date_str = now.date().isoformat()
    current_time_str = now.strftime("%H:%M")

    slot_infos = []
    for s in all_slots:
        is_avail = (s not in booked)
        if normalized_date == current_date_str and s <= current_time_str:
            is_avail = False
        slot_infos.append(SlotInfo(time_slot=s, available=is_avail))
    available_count = sum(1 for s in slot_infos if s.available)

    return SlotsResponse(
        date=normalized_date,
        clinic_hours=f"{CLINIC_OPEN.strftime('%H:%M')}-{CLINIC_CLOSE.strftime('%H:%M')} "
        f"(lunch break {LUNCH_START.strftime('%H:%M')}-{LUNCH_END.strftime('%H:%M')})",
        total_slots=len(all_slots),
        available_count=available_count,
        booked_count=len(booked),
        slots=slot_infos,
    )


@app.post("/book", response_model=BookingResponse, status_code=201)
def book_slot(req: BookingRequest):

    normalized_date = validate_date_str(req.date).isoformat()
    invalid_values = {"<nil>", "nil", "null", "none", "n/a", "unknown", "placeholder"}
    for field_name, value in (("patient_name", req.patient_name), ("problem", req.problem)):
        if str(value).strip().lower() in invalid_values:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {field_name}. Please provide a real value before booking.",
            )

    all_slots = generate_all_slots()
    if req.time_slot not in all_slots:
        raise HTTPException(
            status_code=400,
            detail=f"'{req.time_slot}' is not a valid clinic slot. "
            f"Valid slots are: {', '.join(all_slots)}",
        )

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM bookings WHERE date = ? AND time_slot = ?",
            (normalized_date, req.time_slot),
        ).fetchone()

        if existing:
            booked = {
                r["time_slot"]
                for r in conn.execute(
                    "SELECT time_slot FROM bookings WHERE date = ?", (normalized_date,)
                ).fetchall()
            }
            alternatives = [s for s in all_slots if s not in booked]
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "slot_already_booked",
                    "message": (
                        f"The {req.time_slot} slot on {normalized_date} is already booked. "
                        "Offer the user one of the alternative slots on the same date, "
                        "or ask if they'd like that exact time on a different date."
                    ),
                    "requested_date": normalized_date,
                    "requested_time_slot": req.time_slot,
                    "alternative_slots_same_date": alternatives,
                },
            )

        created_at = datetime.utcnow().isoformat()
        cursor = conn.execute(
            """
            INSERT INTO bookings (username, date, time_slot, patient_name, problem, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (req.username or "guest", normalized_date, req.time_slot, req.patient_name, req.problem, created_at),
        )
        conn.commit()
        booking_id = cursor.lastrowid

    return BookingResponse(
        id=booking_id,
        date=normalized_date,
        time_slot=req.time_slot,
        patient_name=req.patient_name,
        problem=req.problem,
        created_at=created_at,
        message=f"Booked! Slot {req.time_slot} on {normalized_date} is confirmed for: {req.problem}",
        username=req.username or "guest",
    )


@app.get("/bookings")
def list_bookings(
    date: str | None = Query(None, description="Optional date filter in YYYY-MM-DD format"),
    username: str | None = Query(None, description="Optional username filter")
):

    with get_conn() as conn:
        query = "SELECT * FROM bookings WHERE 1=1"
        params = []
        if date:
            query += " AND date = ?"
            params.append(validate_date_str(date).isoformat())
        if username:
            query += " AND username = ?"
            params.append(username)
        query += " ORDER BY date, time_slot"
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def cancel_booking_in_sessions(conn, date: str, time_slot: str, username: str, initiated_by_doctor: bool):
    cursor = conn.execute("SELECT session_id, username, title, messages_json, booking_context_json, last_checked_date, updated_at FROM sessions")
    rows = cursor.fetchall()
    
    for row in rows:
        booking_ctx = json.loads(row["booking_context_json"])
        if booking_ctx.get("date") == date and booking_ctx.get("time_slot") == time_slot:
            booking_ctx = {
                "date": None,
                "time_slot": None,
                "patient_name": None,
                "problem": None
            }
            messages = json.loads(row["messages_json"])
            msg_content = "Your appointment has been cancelled by the Doctor." if initiated_by_doctor else "Your appointment has been cancelled."
            messages.append({
                "role": "assistant",
                "content": msg_content
            })
            
            conn.execute(
                """
                UPDATE sessions
                SET title = ?, booking_context_json = ?, messages_json = ?, last_checked_date = NULL, updated_at = ?
                WHERE session_id = ?
                """,
                ("New Booking Chat", json.dumps(booking_ctx), json.dumps(messages), datetime.utcnow().isoformat(), row["session_id"])
            )


@app.delete("/bookings/{booking_id}", response_model=CancelResponse)
def cancel_booking(booking_id: int, role: str = Query("patient")):
    with get_conn() as conn:
        booking = conn.execute(
            "SELECT date, time_slot, username FROM bookings WHERE id = ?", (booking_id,)
        ).fetchone()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
            
        initiated_by_doctor = (role == "doctor")
        cancel_booking_in_sessions(conn, booking["date"], booking["time_slot"], booking["username"], initiated_by_doctor=initiated_by_doctor)
        
        conn.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
        conn.commit()
    return CancelResponse(message="Booking cancelled", id=booking_id)


@app.delete("/bookings", response_model=CancelResponse)
def cancel_booking_by_slot(
    date: str = Query(..., description="Date of the booking in YYYY-MM-DD format"),
    time_slot: str = Query(..., description="Time slot in HH:MM format, e.g. 10:30")
):
    normalized_date = validate_date_str(date).isoformat()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id, username FROM bookings WHERE date = ? AND time_slot = ?",
            (normalized_date, time_slot),
        ).fetchone()
        if not existing:
            raise HTTPException(
                status_code=404,
                detail=f"No booking found on {normalized_date} at {time_slot}."
            )
            
        cancel_booking_in_sessions(conn, normalized_date, time_slot, existing["username"], initiated_by_doctor=False)
        
        conn.execute("DELETE FROM bookings WHERE id = ?", (existing["id"],))
        conn.commit()
    return CancelResponse(message="Booking cancelled", id=existing["id"])





def load_db_session(session_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        if not row:
            return None
        return {
            "session_id": row["session_id"],
            "username": row["username"],
            "title": row["title"],
            "messages": json.loads(row["messages_json"]),
            "booking_context": json.loads(row["booking_context_json"]),
            "last_checked_date": row["last_checked_date"],
            "updated_at": row["updated_at"]
        }


def serialize_message(m) -> dict:
    if isinstance(m, dict):
        return m
    if hasattr(m, "model_dump"):
        try:
            return m.model_dump()
        except Exception:
            pass
    if hasattr(m, "dict"):
        try:
            return m.dict()
        except Exception:
            pass
    
    res = {
        "role": getattr(m, "role", "assistant"),
        "content": getattr(m, "content", ""),
    }
    tool_calls = getattr(m, "tool_calls", None)
    if tool_calls:
        serialized_tool_calls = []
        for tc in tool_calls:
            if isinstance(tc, dict):
                serialized_tool_calls.append(tc)
            else:
                serialized_tool_calls.append({
                    "function": {
                        "name": tc.function.name if hasattr(tc, "function") else getattr(tc, "name", ""),
                        "arguments": tc.function.arguments if hasattr(tc, "function") else getattr(tc, "arguments", {})
                    }
                })
        res["tool_calls"] = serialized_tool_calls
    return res


def save_db_session(session: dict):
    ctx = session["booking_context"]
    # Auto update title dynamically with Name - Problem - Date
    parts = []
    if ctx.get("patient_name"):
        parts.append(ctx["patient_name"])
    if ctx.get("problem"):
        parts.append(ctx["problem"])
    if ctx.get("date"):
        dt_str = ctx["date"]
        if ctx.get("time_slot"):
            dt_str += f" @ {ctx['time_slot']}"
        parts.append(dt_str)
        
    if parts:
        session["title"] = " - ".join(parts)
    else:
        session["title"] = "New Booking Chat"
        
    serialized_messages = [serialize_message(m) for m in session["messages"]]
    # Update in-memory messages to prevent serializing objects repeatedly
    session["messages"] = serialized_messages

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO sessions (session_id, username, title, messages_json, booking_context_json, last_checked_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                title = excluded.title,
                messages_json = excluded.messages_json,
                booking_context_json = excluded.booking_context_json,
                last_checked_date = excluded.last_checked_date,
                updated_at = excluded.updated_at
            """,
            (
                session["session_id"],
                session["username"],
                session["title"],
                json.dumps(serialized_messages),
                json.dumps(session["booking_context"]),
                session["last_checked_date"],
                datetime.utcnow().isoformat()
            )
        )
        conn.commit()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The user's chat message")
    session_id: str | None = Field(None, description="Existing session ID")
    username: str | None = Field(None, description="The logged in user")
    is_doctor: bool | None = Field(False, description="Whether sent by a doctor")


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class NewSessionResponse(BaseModel):
    session_id: str
    greeting: str


@app.post("/signup")
def signup(req: SignupRequest):
    with get_conn() as conn:
        existing = conn.execute("SELECT username FROM users WHERE username = ?", (req.username.strip(),)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        conn.execute("INSERT INTO users (username, password) VALUES (?, ?)", (req.username.strip(), req.password))
        conn.commit()
    return {"status": "success"}


@app.post("/register")
def register(req: SignupRequest):
    return signup(req)


@app.post("/login")
def login(req: LoginRequest):
    with get_conn() as conn:
        user = conn.execute("SELECT username FROM users WHERE username = ? AND password = ?", (req.username.strip(), req.password)).fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"status": "success", "username": user["username"]}


@app.get("/sessions", response_model=list[SessionInfo])
def get_user_sessions(username: str | None = Query(None)):
    with get_conn() as conn:
        if username:
            rows = conn.execute(
                "SELECT session_id, username, title, updated_at, booking_context_json FROM sessions WHERE username = ? ORDER BY updated_at DESC",
                (username,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT session_id, username, title, updated_at, booking_context_json FROM sessions ORDER BY updated_at DESC"
            ).fetchall()
            
    res = []
    for r in rows:
        d = dict(r)
        d["booking_context"] = json.loads(d.pop("booking_context_json", "{}"))
        res.append(d)
    return res


@app.post("/session", response_model=NewSessionResponse)
def start_session(username: str = Query("guest")):
    session_id = str(uuid.uuid4())
    greeting = "hello I am assistant here are our services\n\n- book an appointment"
    messages = new_conversation()
    messages.append({"role": "assistant", "content": greeting})
    session = {
        "session_id": session_id,
        "username": username,
        "title": "New Booking Chat",
        "messages": messages,
        "last_checked_date": None,
        "booking_context": {
            "date": None,
            "time_slot": None,
            "patient_name": None,
            "problem": None,
            "state": "IDLE"
        }
    }
    save_db_session(session)
    return NewSessionResponse(session_id=session_id, greeting=greeting)


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    username = req.username or "guest"
    if req.session_id:
        session = load_db_session(req.session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Unknown session_id.")
        session_id = req.session_id
    else:
        session_id = str(uuid.uuid4())
        messages = new_conversation()
        session = {
            "session_id": session_id,
            "username": username,
            "title": "New Booking Chat",
            "messages": messages,
            "last_checked_date": None,
            "booking_context": {
                "date": None,
                "time_slot": None,
                "patient_name": None,
                "problem": None,
                "state": "IDLE"
            }
        }

    if req.is_doctor:
        # Doctor directly talks to the patient - bypass LLM agent
        doc_msg = {"role": "assistant", "content": req.message, "is_doctor": True}
        session["messages"].append(doc_msg)
        save_db_session(session)
        return ChatResponse(session_id=session_id, reply=req.message)

    messages = session["messages"]
    messages.append({"role": "user", "content": req.message})

    try:
        reply = run_agent_turn(messages, session)
    except Exception as e:
        reply = f"I encountered an error trying to process that: {str(e)}. Please try again."

    save_db_session(session)
    return ChatResponse(session_id=session_id, reply=reply)


@app.get("/session/{session_id}")
def get_session_detail(session_id: str):
    session = load_db_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.delete("/session/{session_id}")
def end_session(session_id: str):
    with get_conn() as conn:
        existing = conn.execute("SELECT session_id FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Unknown session_id")
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    return {"message": "Session ended", "session_id": session_id}


@app.post("/session/{session_id}/cancel")
def cancel_session_booking(session_id: str):
    session = load_db_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
        
    ctx = session["booking_context"]
    date = ctx.get("date")
    time_slot = ctx.get("time_slot")
    
    with get_conn() as conn:
        if date and time_slot:
            conn.execute("DELETE FROM bookings WHERE date = ? AND time_slot = ?", (date, time_slot))
        
        session["booking_context"] = {
            "date": None,
            "time_slot": None,
            "patient_name": None,
            "problem": None,
            "state": "IDLE"
        }
        session["last_checked_date"] = None
        session["messages"].append({
            "role": "assistant",
            "content": "Your appointment has been cancelled."
        })
        conn.commit()
    save_db_session(session)
    return session


@app.post("/session/{session_id}/reject")
def reject_session_booking(session_id: str):
    session = load_db_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
        
    ctx = session["booking_context"]
    date = ctx.get("date")
    time_slot = ctx.get("time_slot")
    
    with get_conn() as conn:
        if date and time_slot:
            conn.execute("DELETE FROM bookings WHERE date = ? AND time_slot = ?", (date, time_slot))
        
        session["booking_context"] = {
            "date": None,
            "time_slot": None,
            "patient_name": None,
            "problem": None
        }
        session["last_checked_date"] = None
        session["messages"].append({
            "role": "assistant",
            "content": "Your appointment has been rejected by the Doctor."
        })
        conn.commit()
    save_db_session(session)
    return session


@app.post("/session/{session_id}/accept")
def accept_session_booking(session_id: str):
    session = load_db_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
        
    ctx = session["booking_context"]
    date = ctx.get("date")
    time_slot = ctx.get("time_slot")
    
    if not (date and time_slot):
        raise HTTPException(status_code=400, detail="No booking context found to accept")
        
    session["messages"].append({
        "role": "assistant",
        "content": "Your appointment has been accepted/confirmed by the Doctor."
    })
    save_db_session(session)
    return session
