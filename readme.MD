# Clinic Booking Agent

An LLM-driven clinic booking assistant. **FastAPI** is the booking engine
(the only source of truth for availability and conflicts). **LangFlow**
hosts the conversational agent — the LLM decides everything: when to ask
for a date, how to present slots, when to ask for the patient's problem,
and how to handle a slot that's just been taken by someone else. No
hardcoded if/else conversation logic — only tool calls + a system prompt.

```
clinic-booking-agent/
├── backend/                     # FastAPI booking engine
│   ├── main.py                  # /slots, /book, /bookings, /health
│   ├── database.py              # SQLite storage
│   ├── schemas.py                # Pydantic models
│   └── requirements.txt
└── langflow/
    ├── components/
    │   ├── get_available_slots.py   # Tool: fetch whole-day slot list
    │   └── book_slot.py             # Tool: book a slot (handles conflicts)
    ├── SYSTEM_PROMPT.md          # Paste into the Agent component
    └── requirements.txt
```

## How it behaves (already tested)

1. User says something like "I want to book an appointment."
2. Agent asks for a **date**.
3. Agent calls `GetAvailableSlots(date)` → shows **every slot for the whole
   day**, marked available/booked.
4. User picks a slot. Agent asks for the **patient's general problem**
   before booking.
5. Agent calls `BookSlot(date, time_slot, problem, patient_name)`.
   - **Success** → confirms the booking.
   - **Conflict** (someone else already took it) → the same slot on that
     date is rejected; the agent offers the same-day alternatives the API
     returns, or asks if the user wants that exact time on a **different
     date** — since a booked slot only blocks that one date, the same
     time is always free on other days.

Verified directly against the API:
- Booking `10:00` on a date, then trying to book `10:00` again on the
  **same date** → rejected with alternative slots.
- Booking `10:00` on the **next date** → succeeds (the block is
  per-date, not global).

## 1. Run the FastAPI backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Endpoints:
- `GET /slots?date=YYYY-MM-DD` — whole-day slot list with availability
- `POST /book` — `{date, time_slot, problem, patient_name?}`
- `GET /bookings?date=YYYY-MM-DD` — admin view of bookings
- `DELETE /bookings/{id}` — cancel a booking

Interactive docs at `http://localhost:8000/docs`.

## 2. Wire up the LangFlow agent

1. Install and start Ollama, then pull the model:
   ```bash
   ollama pull gemma3:4b
   ollama serve   # usually already running as a service; default port 11434
   ```
2. Install LangFlow (`pip install langflow`) and run `langflow run`.
3. Copy `langflow/components/get_available_slots.py` and
   `langflow/components/book_slot.py` into LangFlow's custom components
   folder (Settings → Components → point it at a folder, or drop them in
   `~/.langflow/components`). Restart LangFlow so they're picked up.
4. Create a new flow:
   - **Chat Input** → **Agent** → **Chat Output**
   - In the Agent component, set the model provider to **Ollama**:
     - `Base URL`: `http://localhost:11434`
     - `Model Name`: `gemma3:4b`
     - No API key needed (it's local).
   - Attach both custom components (**Get Available Slots**, **Book
     Slot**) to the Agent as **Tools**.
   - Set each component's `api_base_url` to `http://localhost:8000`
     (or wherever the FastAPI backend runs).
   - Paste the contents of `langflow/SYSTEM_PROMPT.md` into the Agent's
     system prompt field.
5. Open the flow's chat panel and talk to it — the LLM will ask for the
   date, show slots, ask for the problem, book it, and handle conflicts
   entirely on its own using the two tools.

### Note on using gemma3:4b specifically

`gemma3:4b` is a small model. Tool-calling reliability with small local
models is noticeably weaker than with larger hosted models — it can
occasionally forget to call a tool, call it with malformed arguments, or
try to "hallucinate" slot availability instead of calling
`GetAvailableSlots`. To keep it on track:

- Make sure LangFlow's Ollama integration is invoking it in **tool/function
  calling mode** (not plain chat mode) — check the Agent component's
  "tool calling" toggle if present.
- Keep the system prompt's rules section intact (don't shorten it) — it's
  what stops the model from guessing availability instead of checking.
- If it misbehaves consistently, `gemma3:12b` or `qwen2.5:7b` (also
  Ollama-servable) tend to be noticeably more reliable tool-callers while
  still running locally.

## Why this split

- **FastAPI = facts only.** It enforces the one hard rule that must never
  depend on an LLM's judgment: two people can't hold the same slot on the
  same date. Conflict detection uses a DB `UNIQUE(date, time_slot)`
  constraint, so it's race-safe.
- **LangFlow/LLM = conversation.** Everything about *how* to talk to the
  patient — phrasing, order of questions, adapting when they change their
  mind, deciding whether to offer a same-day alternative or a different
  date — is left entirely to the model via the system prompt, not coded
  as fixed conversation states.

## Extending it

- Add a `PATCH /bookings/{id}` endpoint + a matching "Reschedule" tool if
  you want the agent to move existing bookings.
- Add a `doctor` field to slots/bookings if the clinic has multiple
  practitioners.
- Swap SQLite for Postgres in `database.py` for production — the
  `UNIQUE(date, time_slot)` constraint carries over unchanged.