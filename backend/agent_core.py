
# import json
# import re
# from datetime import date as date_type, timedelta

# import requests
# from ollama import chat

# BACKEND_URL = "http://localhost:8000"
# MODEL = "qwen2.5:14b"
# TODAY = date_type.today().isoformat()
# CURRENT_TIME = date_type.today().strftime("%H:%M")
# BOOKING_FIELDS = ("date", "time_slot", "patient_name", "problem")

# INVALID_PARAM_VALUES = {
#     "", "<nil>", "nil", "null", "none", "n/a", "na", "unknown", "placeholder",
#     "not provided", "tbd", "undefined", "missing",
# }
# BOOKING_CONTEXT = {
#     "date": None,
#     "time_slot": None,
#     "patient_name": None,
#     "problem": None,
#     "state": "IDLE"
# }

# # Pre-computed set of valid clinic slot strings (HH:MM, 24-hour)
# # Must match generate_all_slots() logic in main.py
# def _generate_clinic_slots() -> list[str]:
#     from datetime import time as _time, datetime as _dt
#     OPEN, CLOSE = _time(9, 0), _time(17, 0)
#     LUNCH_S, LUNCH_E = _time(13, 0), _time(14, 0)
#     today = date_type.today()
#     slots, cur = [], _dt.combine(today, OPEN)
#     end = _dt.combine(today, CLOSE)
#     ls = _dt.combine(today, LUNCH_S)
#     le = _dt.combine(today, LUNCH_E)
#     while cur < end:
#         if not (ls <= cur < le):
#             slots.append(cur.strftime("%H:%M"))
#         cur += timedelta(minutes=30)
#     return slots

# VALID_CLINIC_SLOTS: list[str] = _generate_clinic_slots()


# SYSTEM_PROMPT = f"""
# You are MedSync, a clinic appointment assistant.

# Today's Date: {TODAY}
# Current Time: {CURRENT_TIME}

# Current Booking Context:
# {BOOKING_CONTEXT}

# Your only job is to help users:

# • Book appointments
# • Show available appointment slots
# • Cancel appointments

# Never answer unrelated questions.

# ====================================================
# GENERAL RULES
# ====================================================

# - Never invent any information.
# - Never guess a date, time, patient name, or problem.
# - Only use information provided by the user or already present in the Current Booking Context.
# - Never expose tool calls, JSON, internal reasoning, or code.
# - Never change an already confirmed booking field unless the user clearly starts a new booking.

# ====================================================
# GREETING
# ====================================================

# If the user's message is ONLY a greeting such as:

# hi
# hello
# hey
# good morning
# good evening

# Reply EXACTLY:

# hello I am assistant here are our services

# - book an appointment
# - cancel an appointment

# Do not add anything else.

# ====================================================
# BOOKING
# ====================================================

# A booking starts when the user says things like:

# book
# book appointment
# schedule appointment
# show slots
# available slots
# check slots

# If a completely new booking starts, ignore any unfinished booking information.

# ====================================================
# SHOW AVAILABLE SLOTS
# ====================================================

# If the user asks for today's slots,

# normalize the date to today's date.

# Call get_available_slots().

# Display ONLY the slots returned.

# If today's slots are requested,
# display only slots after the current time.

# If the user asks for tomorrow's slots,

# normalize to tomorrow's date.

# Call get_available_slots().

# If the user provides any date expression—exact or relative—

# Resolve it to YYYY-MM-DD and call get_available_slots().

# NEVER ask the user to clarify a date.

# NEVER say “please provide a specific date”.

# Always resolve the date yourself using the mapping below:

# Expressions you MUST resolve silently:

# today               → today's date
# tomorrow            → today + 1 day
# day after tomorrow  → today + 2 days
# this week           → today + 7 days
# next week           → today + 7 days
# fortnight           → today + 14 days
# in a fortnight      → today + 14 days
# in X days           → today + X days  (e.g. “in 3 days” → +3)
# in X weeks          → today + X*7 days (e.g. “in 2 weeks” → +14)
# next monday         → next occurrence of Monday
# next tuesday        → next occurrence of Tuesday
# (and so on for all weekdays)
# this monday/friday  → next occurrence of that weekday

# Always normalise to YYYY-MM-DD before calling get_available_slots().

# The backend Python function normalize_date() resolves these expressions
# automatically, so pass whatever the user said as the ‘date’ argument
# and it will be resolved server-side.

# After displaying slots ALWAYS finish with:

# What time slot would you like to book?

# Never invent slots.

# ====================================================
# TIME SLOT
# ====================================================

# After slots are shown,

# the next user message is usually the selected time slot.

# Examples:

# 9

# 09:00

# 10

# 10:00

# 3 pm

# 15:00

# 10:30

# 10:30

# Normalize every time to HH:MM.

# Do NOT ask the user to confirm the time.

# Do NOT ask

# "Did you mean..."

# "Is that correct?"

# "Would you like to continue?"

# Immediately continue to the next missing field.

# ====================================================
# PATIENT DETAILS
# ====================================================

# Booking requires:

# date
# time_slot
# patient_name
# problem

# Always ask for the patient's full name first.

# After receiving the patient's name,

# ask:

# Could you please specify the problem or reason for the visit?

# If the user gives only the problem,

# store it,

# then ask for the patient's full name.

# If the user provides both name and problem together,

# store both.

# Never ask again for information already collected.

# Accept ANY patient name exactly as entered.

# Examples of valid names:

# John

# abc

# 123

# Cancer

# xyz

# asdf

# Do not validate names.

# Do not reject names.

# Do not ask the user to confirm their name.

# ====================================================
# BOOKING TOOL
# ====================================================

# Call book_slot() ONLY when all four values exist:

# date

# time_slot

# patient_name

# problem

# Immediately call the tool.

# Do NOT ask:

# "Is this correct?"

# "Would you like to proceed?"

# "Please confirm."

# Never request confirmation before booking.

# ====================================================
# SUCCESS
# ====================================================

# After booking succeeds reply EXACTLY:

# Your appointment has been booked for <Formatted Date> at <Time Slot>.

# Patient Name: <Patient Name>

# Problem: <Problem>

# Date: <YYYY-MM-DD>

# Time Slot: <HH:MM>

# ====================================================
# BOOKED SLOT
# ====================================================

# If book_slot() returns that the slot is already booked,

# display the alternative slots returned by the tool,

# then ask:

# What time slot would you like to book?

# Do not restart the booking.

# ====================================================
# CANCELLATION
# ====================================================

# If the user wants to cancel,

# collect:

# date

# time_slot

# Normalize both.

# Call cancel_appointment().

# After success reply EXACTLY:

# Your appointment for <Date> at <Time Slot> has been successfully cancelled.

# ====================================================
# OUT OF SCOPE
# ====================================================

# If the request is unrelated to appointments,

# reply EXACTLY:

# I can only help you with booking or cancelling appointments.

# ====================================================
# VERY IMPORTANT
# ====================================================

# NEVER ask the user to confirm:

# • a date

# • a time

# • a patient name

# • a problem

# • a booking

# Never say:

# "Is this correct?"

# "Would you like to proceed?"

# "Please confirm."

# "Did you mean..."

# Once a value is extracted,

# immediately continue to the next missing field or call the required tool.

# The booking workflow is controlled by Python.

# Your job is only to extract information, ask for missing fields, call tools, and present results."""



# TOOLS_SCHEMA = [
#     {
#         "type": "function",
#         "function": {
#             "name": "get_available_slots",
#             "description": (
#                 "Fetch all clinic slots for a date and their availability. "
#                 "Call when the user asks to check/see slots for a specific date "
#                 "(including 'today' or 'tomorrow' resolved to YYYY-MM-DD). "
#                 "Do NOT call this for a bare time reply after slots were already "
#                 "shown for the current date — that is the time_slot answer, not "
#                 "a new date request."
#             ),
#             "parameters": {
#                 "type": "object",
#                 "required": ["date"],
#                 "properties": {
#                     "date": {"type": "string", "description": "YYYY-MM-DD, normalized by you. Never pass 'today'/'tomorrow' literally."}
#                 },
#             },
#         },
#     },
#     {
#         "type": "function",
#         "function": {
#             "name": "book_slot",
#             "description": "Book a clinic slot. Call ONLY after date, time_slot, patient_name, and problem are all known.",
#             "parameters": {
#                 "type": "object",
#                 "required": ["date", "time_slot", "patient_name", "problem"],
#                 "properties": {
#                     "date": {"type": "string", "description": "YYYY-MM-DD"},
#                     "time_slot": {"type": "string", "description": "HH:MM (24h), normalized by you"},
#                     "patient_name": {"type": "string"},
#                     "problem": {"type": "string"},
#                 },
#             },
#         },
#     },
#     {
#         "type": "function",
#         "function": {
#             "name": "cancel_appointment",
#             "description": "Cancel an existing booking. Call once both date and time_slot for the appointment to cancel are known.",
#             "parameters": {
#                 "type": "object",
#                 "required": ["date", "time_slot"],
#                 "properties": {
#                     "date": {"type": "string", "description": "YYYY-MM-DD"},
#                     "time_slot": {"type": "string", "description": "HH:MM"},
#                 },
#             },
#         },
#     },
# ]



# def _req(method: str, path: str, **kwargs) -> str:
#     try:
#         resp = requests.request(method, f"{BACKEND_URL}{path}", timeout=10, **kwargs)
#         resp.raise_for_status()
#         return json.dumps(resp.json())
#     except requests.exceptions.HTTPError as e:
#         try:
#             err = e.response.json()
#             detail = err.get("detail")
#             if isinstance(detail, dict):
#                 return json.dumps({"error": True, "detail": detail})
#             return json.dumps({"error": True, "message": detail or str(e)})
#         except Exception:
#             return json.dumps({"error": True, "message": e.response.text or str(e)})
#     except requests.exceptions.RequestException as e:
#         return json.dumps({"error": True, "message": str(e)})


# def get_available_slots(date: str) -> str:
#     return _req("GET", "/slots", params={"date": date})


# def book_slot(date: str, time_slot: str, patient_name: str, problem: str, username: str = None) -> str:
#     payload = {"date": date, "time_slot": time_slot, "patient_name": patient_name, "problem": problem}
#     if username:
#         payload["username"] = username
#     return _req("POST", "/book", json=payload)


# def cancel_appointment(date: str, time_slot: str) -> str:
#     return _req("DELETE", "/bookings", params={"date": date, "time_slot": time_slot})


# AVAILABLE_FUNCTIONS = {
#     "get_available_slots": get_available_slots,
#     "book_slot": book_slot,
#     "cancel_appointment": cancel_appointment,
# }



# def _is_valid_param(value) -> bool:
#     if value is None:
#         return False
#     text = str(value).strip()
#     if not text or text.lower() in INVALID_PARAM_VALUES:
#         return False
#     if "<" in text.lower() and ">" in text.lower():
#         return False
#     return True


# def normalize_time_slot(value) -> str | None:
#     if not _is_valid_param(value):
#         return None

#     v = str(value).strip().lower()


#     match = re.search(
#         r'(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
#         v
#     )

#     if not match:
#         return None

#     v = match.group(1).replace(" ", "")

#     # 3pm / 10am
#     m = re.fullmatch(r"(\d{1,2})(am|pm)", v)
#     if m:
#         hour = int(m.group(1)) % 12
#         if m.group(2) == "pm":
#             hour += 12
#         return f"{hour:02d}:00"

#     # 10:30pm
#     m = re.fullmatch(r"(\d{1,2}):(\d{2})(am|pm)", v)
#     if m:
#         hour = int(m.group(1)) % 12
#         if m.group(3) == "pm":
#             hour += 12
#         return f"{hour:02d}:{m.group(2)}"

#     # 10:30
#     m = re.fullmatch(r"(\d{1,2}):(\d{2})", v)
#     if m:
#         hour = int(m.group(1))
#         minute = int(m.group(2))
#         if 0 <= hour <= 23 and 0 <= minute <= 59:
#             return f"{hour:02d}:{minute:02d}"

#     # 10
#     if v.isdigit():
#         hour = int(v)
#         if 0 <= hour <= 23:
#             return f"{hour:02d}:00"

#     return None

# def normalize_date(value) -> str | None:
#     if not _is_valid_param(value):
#         return None

#     v = str(value).strip().lower()
#     today = date_type.today()

#     # ── Relative keyword expressions ───────────────────────────────────────
#     if v in ("today",):
#         return today.isoformat()

#     if v in ("tomorrow",):
#         return (today + timedelta(days=1)).isoformat()

#     if v in ("day after tomorrow", "day after tmr", "overmorrow"):
#         return (today + timedelta(days=2)).isoformat()

#     if v in ("fortnight", "in a fortnight", "in fortnight", "a fortnight", "two weeks", "2 weeks"):
#         return (today + timedelta(days=14)).isoformat()

#     if v in ("next week", "this week", "in a week", "one week", "1 week"):
#         return (today + timedelta(days=7)).isoformat()

#     # ── "in X days" / "in X weeks" ──────────────────────────────────────
#     m = re.search(r'in\s+(\d+)\s+days?', v)
#     if m:
#         return (today + timedelta(days=int(m.group(1)))).isoformat()

#     m = re.search(r'in\s+(\d+)\s+weeks?', v)
#     if m:
#         return (today + timedelta(weeks=int(m.group(1)))).isoformat()

#     m = re.search(r'in\s+(\d+)\s+months?', v)
#     if m:
#         # rough approximation: 30 days per month
#         return (today + timedelta(days=int(m.group(1)) * 30)).isoformat()

#     # ── Weekday names: "next monday", "this friday", "monday", etc. ────────
#     WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
#     for i, day_name in enumerate(WEEKDAYS):
#         patterns = [
#             f"next {day_name}",
#             f"this {day_name}",
#             f"coming {day_name}",
#             day_name,
#         ]
#         if any(p == v for p in patterns):
#             days_ahead = (i - today.weekday()) % 7
#             if days_ahead == 0:          # same weekday → next week
#                 days_ahead = 7
#             return (today + timedelta(days=days_ahead)).isoformat()

#     # ── Bare day number: "15", "20", etc. ───────────────────────────────
#     raw = str(value).strip()
#     if raw.isdigit():
#         day = int(raw)
#         if 1 <= day <= 31:
#             try:
#                 target = today.replace(day=day)
#                 if target < today:
#                     nxt_month = today.month + 1 if today.month < 12 else 1
#                     nxt_year = today.year if today.month < 12 else today.year + 1
#                     target = target.replace(year=nxt_year, month=nxt_month)
#                 return target.isoformat()
#             except ValueError:
#                 pass

#     # ── Pass through anything else (e.g. YYYY-MM-DD already formatted) ──────
#     return str(value).strip()


# def _get_missing_params(tool_name: str, args: dict) -> list[str]:
#     required = {
#         "get_available_slots": ["date"],
#         "book_slot": list(BOOKING_FIELDS),
#         "cancel_appointment": ["date", "time_slot"],
#     }
#     return [p for p in required.get(tool_name, []) if not _is_valid_param(args.get(p))]


# def _tool_error_message(result: dict) -> str:
#     detail = result.get("detail")
#     if isinstance(detail, dict):
#         return detail.get("message") or result.get("message") or "I could not complete that action."
#     return result.get("message") or str(detail or "I could not complete that action.")



# def new_conversation() -> list:
#     return [{"role": "system", "content": _render_system_prompt({})}]


# def _render_system_prompt(context: dict) -> str:
#     today = date_type.today()
#     tomorrow = today + timedelta(days=1)
#     ctx_lines = "\n".join(f"- {k}: {v or 'null'}" for k, v in context.items()) or "(none yet)"
#     return (
#         f"Today's date is: {today.isoformat()}\n"
#         f"Tomorrow's date is: {tomorrow.isoformat()}\n\n"
#         f"CURRENT BOOKING CONTEXT (already-confirmed fields, trust this over your own memory):\n"
#         f"{ctx_lines}\n\n"
#         f"{SYSTEM_PROMPT}"
#     )


# def run_agent_turn(messages: list, session: dict = None) -> str:
#     if session is not None and "booking_context" not in session:
#         session["booking_context"] = {k: None for k in BOOKING_FIELDS}
#         session["booking_context"]["state"] = "IDLE"

#     # ── State-machine: extract date / time from raw user message ──────────────
#     if session is not None and messages and messages[-1]["role"] == "user":
#         user_message = messages[-1]["content"].strip()
#         ctx = session["booking_context"]

#         # Only attempt date/time parsing on short, plausibly numeric messages
#         # to avoid storing free-text (names, problems) as dates/times.
#         _looks_like_datetime = bool(
#             re.search(r'\d', user_message) and len(user_message) <= 30
#         )

#         if not ctx.get("date") and _looks_like_datetime:
#             # Waiting for date
#             booking_date = normalize_date(user_message)
#             if booking_date:
#                 ctx["date"] = booking_date
#                 ctx["state"] = "DATE_SELECTED"

#         elif ctx.get("date") and not ctx.get("time_slot") and _looks_like_datetime:
#             # Waiting for time slot
#             time_slot = normalize_time_slot(user_message)
#             if time_slot:
#                 ctx["time_slot"] = time_slot
#                 ctx["state"] = "WAIT_NAME"
#     # ─────────────────────────────────────────────────────────────────────────

#     for _ in range(5):
#         if session is not None and messages and messages[0]["role"] == "system":
#             messages[0]["content"] = _render_system_prompt(session["booking_context"])

#         response = chat(model=MODEL, messages=messages, tools=TOOLS_SCHEMA)
#         msg = response["message"]
#         content = msg.get("content") or ""
#         tool_calls = msg.get("tool_calls")


#         if not tool_calls and content.strip().startswith("{") and content.strip().endswith("}"):
#             try:
#                 data = json.loads(content.strip())
#                 if isinstance(data, dict) and ("name" in data or "function" in data):
#                     name = data.get("name") or data.get("function")
#                     if isinstance(name, dict):
#                         name = name.get("name")
#                     args = data.get("parameters") or data.get("arguments") or {}
#                     name_str = str(name).strip().lower().replace(" ", "_").replace("-", "_")
#                     name = {
#                         "book_appointment": "book_slot", "book": "book_slot",
#                         "cancel_booking": "cancel_appointment", "cancel": "cancel_appointment",
#                         "get_slots": "get_available_slots", "check_slots": "get_available_slots",
#                         "slots": "get_available_slots",
#                     }.get(name_str, name_str)
#                     tool_calls = [{"function": {"name": name, "arguments": args}}]
#                     msg["tool_calls"] = tool_calls
#                     msg["content"] = ""
#             except Exception:
#                 pass

#         if not tool_calls:
#             messages.append(msg)
#             content = msg.get("content") or ""
#             if not content.strip():
#                 content = "Could you tell me a bit more about what you'd like to do?"
#                 messages[-1] = {"role": "assistant", "content": content}
#             return content

#         messages.append(msg)

#         for call in tool_calls:
#             name = call["function"]["name"]
#             args = call["function"].get("arguments") or {}
#             if isinstance(args, str):
#                 try:
#                     args = json.loads(args)
#                 except json.JSONDecodeError:
#                     args = {}

#             if "date" in args:
#                 args["date"] = normalize_date(args["date"])
#             if "time_slot" in args:
#                 args["time_slot"] = normalize_time_slot(args["time_slot"])

#             ctx = session["booking_context"] if session is not None else {}

#             # ── Args updater: persist tool args into booking context ──────────
#             if session is not None:
#                 if args.get("date"):
#                     ctx["date"] = args["date"]
#                     ctx["state"] = "DATE_SELECTED"

#                 if args.get("time_slot"):
#                     ctx["time_slot"] = args["time_slot"]
#                     ctx["state"] = "TIME_SELECTED"

#                 if args.get("patient_name"):
#                     ctx["patient_name"] = args["patient_name"]
#                     ctx["state"] = "NAME_COLLECTED"

#                 if args.get("problem"):
#                     ctx["problem"] = args["problem"]
#                     ctx["state"] = "READY_TO_BOOK"
#             # ─────────────────────────────────────────────────────────────────



#             # book_slot: fill any missing field from confirmed context, but let
#             # the model's freshly-provided value win for name/problem (those are
#             # this turn's answer); context wins for date/time_slot (established
#             # earlier, must not be silently overwritten by a hallucination)
#             if name == "book_slot" and session is not None:
#                 ctx = session["booking_context"]
#                 for k in ("date", "time_slot"):
#                     args[k] = (ctx.get(k) if _is_valid_param(ctx.get(k)) else None) or args.get(k)
#                 for k in ("patient_name", "problem"):
#                     args[k] = args.get(k) if _is_valid_param(args.get(k)) else ctx.get(k)
#                 if session.get("username"):
#                     args["username"] = session["username"]

#             # ── Validation guard: ensure context is complete before book_slot ─
#             if name == "book_slot" and session is not None:
#                 ctx = session["booking_context"]

#                 if ctx.get("date") is None:
#                     messages.append({"role": "tool", "name": name, "tool_name": name,
#                                      "content": json.dumps({"error": True, "message": "What date would you like to book?"})})
#                     messages.append({"role": "assistant", "content": "What date would you like to book?"})
#                     return "What date would you like to book?"

#                 if ctx.get("time_slot") is None:
#                     messages.append({"role": "tool", "name": name, "tool_name": name,
#                                      "content": json.dumps({"error": True, "message": "What time slot would you like to book?"})})
#                     messages.append({"role": "assistant", "content": "What time slot would you like to book?"})
#                     return "What time slot would you like to book?"

#                 # ── Time-slot existence check ──────────────────────────────────
#                 if ctx.get("time_slot") and ctx["time_slot"] not in VALID_CLINIC_SLOTS:
#                     bad_slot = ctx["time_slot"]
#                     # Clear the invalid slot so the user is asked again
#                     ctx["time_slot"] = None
#                     ctx["state"] = "DATE_SELECTED"
#                     args["time_slot"] = None
#                     valid_list = ", ".join(VALID_CLINIC_SLOTS)
#                     reply = (
#                         f"'{bad_slot}' is not a valid clinic slot.\n\n"
#                         f"Available slots are:\n"
#                         + "\n".join(f"- {s}" for s in VALID_CLINIC_SLOTS)
#                         + "\n\nWhat time slot would you like to book?"
#                     )
#                     messages.append({"role": "tool", "name": name, "tool_name": name,
#                                      "content": json.dumps({"error": True, "message": reply})})
#                     messages.append({"role": "assistant", "content": reply})
#                     return reply
#                 # ─────────────────────────────────────────────────────────────

#                 if ctx.get("patient_name") is None:
#                     messages.append({"role": "tool", "name": name, "tool_name": name,
#                                      "content": json.dumps({"error": True, "message": "What is the patient's full name?"})})
#                     messages.append({"role": "assistant", "content": "What is the patient's full name?"})
#                     return "What is the patient's full name?"

#                 if ctx.get("problem") is None:
#                     messages.append({"role": "tool", "name": name, "tool_name": name,
#                                      "content": json.dumps({"error": True, "message": "Could you please specify the problem or reason for the visit?"})})
#                     messages.append({"role": "assistant", "content": "Could you please specify the problem or reason for the visit?"})
#                     return "Could you please specify the problem or reason for the visit?"
#             # ─────────────────────────────────────────────────────────────────

#             missing = _get_missing_params(name, args)
#             if missing:
#                 raw_result = json.dumps({
#                     "error": True,
#                     "message": f"Missing or invalid parameters: {', '.join(missing)}. Ask the user for them.",
#                 })
#             else:
#                 func = AVAILABLE_FUNCTIONS.get(name)
#                 if func is None:
#                     raw_result = json.dumps({"error": True, "message": f"Tool '{name}' is not available."})
#                 else:
#                     try:
#                         raw_result = func(**args)
#                     except Exception as e:
#                         raw_result = json.dumps({"error": True, "message": str(e)})

#             # ── Date / slot validator for get_available_slots ─────────────────
#             if name == "get_available_slots":
#                 try:
#                     slot_data = json.loads(raw_result)
#                     # Error from backend (e.g. past date, bad format)
#                     if slot_data.get("error") or slot_data.get("detail"):
#                         no_slots_reply = "No slots available at this time."
#                         messages.append({"role": "tool", "name": name, "tool_name": name,
#                                          "content": json.dumps({"error": True, "message": no_slots_reply})})
#                         messages.append({"role": "assistant", "content": no_slots_reply})
#                         return no_slots_reply
#                     # Valid date but zero available slots
#                     if slot_data.get("available_count", -1) == 0:
#                         no_slots_reply = "No slots available at this time."
#                         messages.append({"role": "tool", "name": name, "tool_name": name,
#                                          "content": json.dumps({"available_count": 0, "message": no_slots_reply})})
#                         messages.append({"role": "assistant", "content": no_slots_reply})
#                         return no_slots_reply
#                 except (json.JSONDecodeError, AttributeError):
#                     pass
#             # ─────────────────────────────────────────────────────────────────

#             messages.append({"role": "tool", "name": name, "tool_name": name, "content": raw_result})

#             if session is not None:
#                 if name in ("get_available_slots", "book_slot"):
#                     # a NEW date for get_available_slots clears stale downstream fields
#                     if name == "get_available_slots" and args.get("date"):
#                         if session["booking_context"].get("date") and args["date"] != session["booking_context"]["date"]:
#                             session["booking_context"]["time_slot"] = None
#                             session["booking_context"]["patient_name"] = None
#                             session["booking_context"]["problem"] = None
#                     for k in BOOKING_FIELDS:
#                         if _is_valid_param(args.get(k)):
#                             session["booking_context"][k] = args[k]

#                 if name == "book_slot":
#                     try:
#                         result = json.loads(raw_result)
#                         if not result.get("error"):
#                             session["booking_context"] = {k: None for k in BOOKING_FIELDS}
#                             session["booking_context"]["state"] = "IDLE"
#                     except json.JSONDecodeError:
#                         pass

#                 # cancel_appointment intentionally never writes into booking_context
#                 # (it may target a different appointment than the one being built)

#     return "I am processing too many requests at the moment. Please try again."


# if __name__ == "__main__":
#     msgs = new_conversation()
#     sess = {"username": None}
#     print("MedSync agent ready. Type 'quit' to exit.")
#     while True:
#         try:
#             user_in = input("You: ")
#         except EOFError:
#             break
#         if user_in.strip().lower() in ("quit", "exit"):
#             break
#         msgs.append({"role": "user", "content": user_in})
#         reply = run_agent_turn(msgs, sess)
#         print(f"Assistant: {reply}\n")



import json
import re
from datetime import date as date_type, timedelta

import requests
from ollama import chat

BACKEND_URL = "http://localhost:8000"
MODEL = "qwen2.5:14b"
TODAY = date_type.today().isoformat()
CURRENT_TIME = date_type.today().strftime("%H:%M")
BOOKING_FIELDS = ("date", "time_slot", "patient_name", "problem")

INVALID_PARAM_VALUES = {
    "", "<nil>", "nil", "null", "none", "n/a", "na", "unknown", "placeholder",
    "not provided", "tbd", "undefined", "missing",
}
BOOKING_CONTEXT = {
    "date": None,
    "time_slot": None,
    "patient_name": None,
    "problem": None,
    "state": "IDLE"
}
CANCEL_CONTEXT = {
    "date": None,
    "time_slot": None,
    "state": "IDLE"
}


def _generate_clinic_slots() -> list[str]:
    from datetime import time as _time, datetime as _dt
    OPEN, CLOSE = _time(9, 0), _time(17, 0)
    LUNCH_S, LUNCH_E = _time(13, 0), _time(14, 0)
    today = date_type.today()
    slots, cur = [], _dt.combine(today, OPEN)
    end = _dt.combine(today, CLOSE)
    ls = _dt.combine(today, LUNCH_S)
    le = _dt.combine(today, LUNCH_E)
    while cur < end:
        if not (ls <= cur < le):
            slots.append(cur.strftime("%H:%M"))
        cur += timedelta(minutes=30)
    return slots

VALID_CLINIC_SLOTS: list[str] = _generate_clinic_slots()


SYSTEM_PROMPT = f"""
You are MedSync, a clinic appointment assistant.

Today's Date: {TODAY}
Current Time: {CURRENT_TIME}

Current Booking Context:
{BOOKING_CONTEXT}

Your only job is to help users:

• Book appointments
• Show available appointment slots
• Cancel appointments

Never answer unrelated questions.

====================================================
GENERAL RULES
====================================================

- Never invent any information.
- Never guess a date, time, patient name, or problem.
- Only use information provided by the user or already present in the Current Booking Context.
- Never expose tool calls, JSON, internal reasoning, or code.
- Never change an already confirmed booking field unless the user clearly starts a new booking.

====================================================
GREETING
====================================================

If the user's message is ONLY a greeting such as:

hi
hello
hey
good morning
good evening

Reply EXACTLY:

hello I am assistant here are our services

- book an appointment
- cancel an appointment

Do not add anything else.

====================================================
BOOKING
====================================================

A booking starts when the user says things like:

book
book appointment
schedule appointment
show slots
available slots
check slots

If a completely new booking starts, ignore any unfinished booking information.

====================================================
SHOW AVAILABLE SLOTS
====================================================

If the user asks for today's slots,

normalize the date to today's date.

Call get_available_slots().

Display ONLY the slots returned.

If today's slots are requested,
display only slots after the current time.

If the user asks for tomorrow's slots,

normalize to tomorrow's date.

Call get_available_slots().

If the user provides any date expression—exact or relative—

Resolve it to YYYY-MM-DD and call get_available_slots().

NEVER ask the user to clarify a date.

NEVER say “please provide a specific date”.

Always resolve the date yourself using the mapping below:

Expressions you MUST resolve silently:

today               → today's date
tomorrow            → today + 1 day
day after tomorrow  → today + 2 days
this week           → today + 7 days
next week           → today + 7 days
fortnight           → today + 14 days
in a fortnight      → today + 14 days
in X days           → today + X days  (e.g. “in 3 days” → +3)
in X weeks          → today + X*7 days (e.g. “in 2 weeks” → +14)
next monday         → next occurrence of Monday
next tuesday        → next occurrence of Tuesday
(and so on for all weekdays)
this monday/friday  → next occurrence of that weekday

Always normalise to YYYY-MM-DD before calling get_available_slots().

The backend Python function normalize_date() resolves these expressions
automatically, so pass whatever the user said as the ‘date’ argument
and it will be resolved server-side.

After displaying slots ALWAYS finish with:

What time slot would you like to book?

Never invent slots.

====================================================
TIME SLOT
====================================================

After slots are shown,

the next user message is usually the selected time slot.

Examples:

9

09:00

10

10:00

3 pm

15:00

10:30

10:30

Normalize every time to HH:MM.

Do NOT ask the user to confirm the time.

Do NOT ask

"Did you mean..."

"Is that correct?"

"Would you like to continue?"

Immediately continue to the next missing field.

====================================================
PATIENT DETAILS
====================================================

Booking requires:

date
time_slot
patient_name
problem

Always ask for the patient's full name first.

After receiving the patient's name,

ask:

Could you please specify the problem or reason for the visit?

If the user gives only the problem,

store it,

then ask for the patient's full name.

If the user provides both name and problem together,

store both.

Never ask again for information already collected.

Accept ANY patient name exactly as entered.

Examples of valid names:

John

abc

123

Cancer

xyz

asdf

Do not validate names.

Do not reject names.

Do not ask the user to confirm their name.

====================================================
BOOKING TOOL
====================================================

Call book_slot() ONLY when all four values exist:

date

time_slot

patient_name

problem

Immediately call the tool.

Do NOT ask:

"Is this correct?"

"Would you like to proceed?"

"Please confirm."

Never request confirmation before booking.

====================================================
SUCCESS
====================================================

After booking succeeds reply EXACTLY:

Your appointment has been booked for <Formatted Date> at <Time Slot>.

Patient Name: <Patient Name>

Problem: <Problem>

Date: <YYYY-MM-DD>

Time Slot: <HH:MM>

====================================================
BOOKED SLOT
====================================================

If book_slot() returns that the slot is already booked,

display the alternative slots returned by the tool,

then ask:

What time slot would you like to book?

Do not restart the booking.

====================================================
CANCELLATION
====================================================

If the user wants to cancel,

collect:

date

time_slot

Normalize both.

Call cancel_appointment() IMMEDIATELY once both are known.

Do NOT ask:

"Are you sure you want to cancel this appointment?"

"Do you want to proceed with the cancellation?"

"Please confirm."

Never request confirmation before cancelling.

After success reply EXACTLY:

Your appointment for <Date> at <Time Slot> has been successfully cancelled.

====================================================
OUT OF SCOPE
====================================================

If the request is unrelated to appointments,

reply EXACTLY:

I can only help you with booking or cancelling appointments.

====================================================
VERY IMPORTANT
====================================================

NEVER ask the user to confirm:

• a date

• a time

• a patient name

• a problem

• a booking

• a cancellation

Never say:

"Is this correct?"

"Would you like to proceed?"

"Please confirm."

"Did you mean..."

"Are you sure you want to cancel this appointment?"

Once a value is extracted,

immediately continue to the next missing field or call the required tool.

The booking workflow is controlled by Python.

Your job is only to extract information, ask for missing fields, call tools, and present results."""



TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_available_slots",
            "description": (
                "Fetch all clinic slots for a date and their availability. "
                "Call when the user asks to check/see slots for a specific date "
                "(including 'today' or 'tomorrow' resolved to YYYY-MM-DD). "
                "Do NOT call this for a bare time reply after slots were already "
                "shown for the current date — that is the time_slot answer, not "
                "a new date request."
            ),
            "parameters": {
                "type": "object",
                "required": ["date"],
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD, normalized by you. Never pass 'today'/'tomorrow' literally."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_slot",
            "description": "Book a clinic slot. Call ONLY after date, time_slot, patient_name, and problem are all known.",
            "parameters": {
                "type": "object",
                "required": ["date", "time_slot", "patient_name", "problem"],
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "time_slot": {"type": "string", "description": "HH:MM (24h), normalized by you"},
                    "patient_name": {"type": "string"},
                    "problem": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_appointment",
            "description": "Cancel an existing booking. Call once both date and time_slot for the appointment to cancel are known. Call this immediately — never ask the user to confirm the cancellation first.",
            "parameters": {
                "type": "object",
                "required": ["date", "time_slot"],
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "time_slot": {"type": "string", "description": "HH:MM"},
                },
            },
        },
    },
]



def _req(method: str, path: str, **kwargs) -> str:
    try:
        resp = requests.request(method, f"{BACKEND_URL}{path}", timeout=10, **kwargs)
        resp.raise_for_status()
        return json.dumps(resp.json())
    except requests.exceptions.HTTPError as e:
        try:
            err = e.response.json()
            detail = err.get("detail")
            if isinstance(detail, dict):
                return json.dumps({"error": True, "detail": detail})
            return json.dumps({"error": True, "message": detail or str(e)})
        except Exception:
            return json.dumps({"error": True, "message": e.response.text or str(e)})
    except requests.exceptions.RequestException as e:
        return json.dumps({"error": True, "message": str(e)})


def get_available_slots(date: str) -> str:
    return _req("GET", "/slots", params={"date": date})


def book_slot(date: str, time_slot: str, patient_name: str, problem: str, username: str = None) -> str:
    payload = {"date": date, "time_slot": time_slot, "patient_name": patient_name, "problem": problem}
    if username:
        payload["username"] = username
    return _req("POST", "/book", json=payload)


def cancel_appointment(date: str, time_slot: str) -> str:
    return _req("DELETE", "/bookings", params={"date": date, "time_slot": time_slot})


AVAILABLE_FUNCTIONS = {
    "get_available_slots": get_available_slots,
    "book_slot": book_slot,
    "cancel_appointment": cancel_appointment,
}



def _is_valid_param(value) -> bool:
    if value is None:
        return False
    text = str(value).strip()
    if not text or text.lower() in INVALID_PARAM_VALUES:
        return False
    if "<" in text.lower() and ">" in text.lower():
        return False
    return True


def normalize_time_slot(value) -> str | None:
    if not _is_valid_param(value):
        return None

    v = str(value).strip().lower()


    match = re.search(
        r'(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
        v
    )

    if not match:
        return None

    v = match.group(1).replace(" ", "")


    m = re.fullmatch(r"(\d{1,2})(am|pm)", v)
    if m:
        hour = int(m.group(1)) % 12
        if m.group(2) == "pm":
            hour += 12
        return f"{hour:02d}:00"


    m = re.fullmatch(r"(\d{1,2}):(\d{2})(am|pm)", v)
    if m:
        hour = int(m.group(1)) % 12
        if m.group(3) == "pm":
            hour += 12
        return f"{hour:02d}:{m.group(2)}"


    m = re.fullmatch(r"(\d{1,2}):(\d{2})", v)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2))
        if 1 <= hour <= 8:
            hour += 12
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"


    if v.isdigit():
        hour = int(v)
        if 1 <= hour <= 8:
            hour += 12
        if 0 <= hour <= 23:
            return f"{hour:02d}:00"

    return None

def normalize_date(value) -> str | None:
    if not _is_valid_param(value):
        return None

    v = str(value).strip().lower()
    today = date_type.today()


    if v in ("today",):
        return today.isoformat()

    if v in ("tomorrow",):
        return (today + timedelta(days=1)).isoformat()

    if v in ("day after tomorrow", "day after tmr", "overmorrow"):
        return (today + timedelta(days=2)).isoformat()

    if v in ("fortnight", "in a fortnight", "in fortnight", "a fortnight", "two weeks", "2 weeks"):
        return (today + timedelta(days=14)).isoformat()

    if v in ("next week", "this week", "in a week", "one week", "1 week"):
        return (today + timedelta(days=7)).isoformat()


    m = re.search(r'in\s+(\d+)\s+days?', v)
    if m:
        return (today + timedelta(days=int(m.group(1)))).isoformat()

    m = re.search(r'in\s+(\d+)\s+weeks?', v)
    if m:
        return (today + timedelta(weeks=int(m.group(1)))).isoformat()

    m = re.search(r'in\s+(\d+)\s+months?', v)
    if m:

        return (today + timedelta(days=int(m.group(1)) * 30)).isoformat()


    WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, day_name in enumerate(WEEKDAYS):
        patterns = [
            f"next {day_name}",
            f"this {day_name}",
            f"coming {day_name}",
            day_name,
        ]
        if any(p == v for p in patterns):
            days_ahead = (i - today.weekday()) % 7
            if days_ahead == 0:     
                days_ahead = 7
            return (today + timedelta(days=days_ahead)).isoformat()


    _MONTHS_MAP = {
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
        "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
        "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
        "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
    }
    m = re.fullmatch(r'(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{2,4}))?', v)
    if m and m.group(2) in _MONTHS_MAP:
        day, month, year = int(m.group(1)), _MONTHS_MAP[m.group(2)], m.group(3)
        try:
            if year:
                yr = int(year)
                if yr < 100:
                    yr += 2000
                return date_type(yr, month, day).isoformat()
            candidate = date_type(today.year, month, day)
            if candidate < today:
                candidate = candidate.replace(year=today.year + 1)
            return candidate.isoformat()
        except ValueError:
            pass

    m = re.fullmatch(r'([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{2,4}))?', v)
    if m and m.group(1) in _MONTHS_MAP:
        month, day, year = _MONTHS_MAP[m.group(1)], int(m.group(2)), m.group(3)
        try:
            if year:
                yr = int(year)
                if yr < 100:
                    yr += 2000
                return date_type(yr, month, day).isoformat()
            candidate = date_type(today.year, month, day)
            if candidate < today:
                candidate = candidate.replace(year=today.year + 1)
            return candidate.isoformat()
        except ValueError:
            pass


    raw = str(value).strip()
    if raw.isdigit():
        day = int(raw)
        if 1 <= day <= 31:
            try:
                target = today.replace(day=day)
                if target < today:
                    nxt_month = today.month + 1 if today.month < 12 else 1
                    nxt_year = today.year if today.month < 12 else today.year + 1
                    target = target.replace(year=nxt_year, month=nxt_month)
                return target.isoformat()
            except ValueError:
                pass

    return str(value).strip()


def _get_missing_params(tool_name: str, args: dict) -> list[str]:
    required = {
        "get_available_slots": ["date"],
        "book_slot": list(BOOKING_FIELDS),
        "cancel_appointment": ["date", "time_slot"],
    }
    return [p for p in required.get(tool_name, []) if not _is_valid_param(args.get(p))]


def _tool_error_message(result: dict) -> str:
    detail = result.get("detail")
    if isinstance(detail, dict):
        return detail.get("message") or result.get("message") or "I could not complete that action."
    return result.get("message") or str(detail or "I could not complete that action.")


_CANCEL_CONFIRM_PATTERN = re.compile(
    r'(are you sure|do you want to (cancel|proceed)|would you like to (cancel|proceed)|'
    r'please confirm|confirm.*cancel|proceed with the cancellation)',
    re.IGNORECASE,
)

_CANCEL_INTENT_PATTERN = re.compile(
    r'\bcancel\b', re.IGNORECASE,
)


def new_conversation() -> list:
    return [{"role": "system", "content": _render_system_prompt({})}]


def _render_system_prompt(context: dict) -> str:
    today = date_type.today()
    tomorrow = today + timedelta(days=1)
    ctx_lines = "\n".join(f"- {k}: {v or 'null'}" for k, v in context.items()) or "(none yet)"
    return (
        f"Today's date is: {today.isoformat()}\n"
        f"Tomorrow's date is: {tomorrow.isoformat()}\n\n"
        f"CURRENT BOOKING CONTEXT (already-confirmed fields, trust this over your own memory):\n"
        f"{ctx_lines}\n\n"
        f"{SYSTEM_PROMPT}"
    )


def run_agent_turn(messages: list, session: dict = None) -> str:
    if session is not None and "booking_context" not in session:
        session["booking_context"] = {k: None for k in BOOKING_FIELDS}
        session["booking_context"]["state"] = "IDLE"
    if session is not None and "cancel_context" not in session:
        session["cancel_context"] = {"date": None, "time_slot": None, "state": "IDLE"}


    if session is not None and messages and messages[-1]["role"] == "user":
        user_message = messages[-1]["content"].strip()
        cctx = session["cancel_context"]

        if _CANCEL_INTENT_PATTERN.search(user_message) and cctx["state"] == "IDLE":
            cctx["state"] = "AWAITING_DATE"
            cctx["date"] = None
            cctx["time_slot"] = None

        elif cctx["state"] in ("AWAITING_DATE", "AWAITING_TIME"):
 
            _MONTHS = r'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
            _WEEKDAYS = r'monday|tuesday|wednesday|thursday|friday|saturday|sunday'
            date_frag = re.search(
                r'(?:\bdate\b|\bon\b)\s*[:\-]?\s*'
                r'(today|tomorrow|day after tomorrow'
                rf'|next (?:{_WEEKDAYS})|this (?:{_WEEKDAYS})'
                r'|\d{4}-\d{2}-\d{2}'
                rf'|\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{_MONTHS})(?:\s+\d{{2,4}})?'
                r'|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?'
                r'|\d{1,2}(?:st|nd|rd|th)?)',
                user_message, re.IGNORECASE,
            )
            time_frag = re.search(
                r'(?:\btime\b|\bat\b)\s*[:\-]?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
                user_message, re.IGNORECASE,
            )

            if not date_frag:
                date_frag = re.search(
                    rf'(\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{_MONTHS})(?:\s+\d{{2,4}})?'
                    rf'|(?:{_MONTHS})\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+\d{{2,4}})?'
                    r'|\d{4}-\d{2}-\d{2})',
                    user_message, re.IGNORECASE,
                )

            bare_candidate = user_message if len(user_message) <= 30 else None

            if not cctx.get("date"):
                candidate = normalize_date(
                    date_frag.group(1) if date_frag else bare_candidate
                )

                if candidate and re.fullmatch(r'\d{4}-\d{2}-\d{2}', candidate):
                    cctx["date"] = candidate
                    cctx["state"] = "AWAITING_TIME"

            if cctx.get("date") and not cctx.get("time_slot"):
                time_source = time_frag.group(1) if time_frag else (bare_candidate if not date_frag else None)
                candidate_time = normalize_time_slot(time_source) if time_source else None
                if candidate_time:
                    cctx["time_slot"] = candidate_time
                    cctx["state"] = "READY_TO_CANCEL"

    if session is not None and session["cancel_context"]["state"] == "READY_TO_CANCEL":
        cctx = session["cancel_context"]
        cdate, ctime = cctx["date"], cctx["time_slot"]
        raw_result = cancel_appointment(cdate, ctime)
        try:
            result = json.loads(raw_result)
        except json.JSONDecodeError:
            result = {"error": True}
        if not result.get("error"):
            reply = f"Your appointment for {cdate} at {ctime} has been successfully cancelled."
            session["cancel_context"] = {"date": None, "time_slot": None, "state": "IDLE"}
        else:
            reply = _tool_error_message(result)

            session["cancel_context"] = {"date": None, "time_slot": None, "state": "AWAITING_DATE"}
        messages.append({"role": "assistant", "content": reply})
        return reply

    if session is not None and messages and messages[-1]["role"] == "user" \
            and session["cancel_context"]["state"] == "IDLE":
        user_message = messages[-1]["content"].strip()
        ctx = session["booking_context"]


        _looks_like_datetime = bool(
            re.search(r'\d', user_message) and len(user_message) <= 30
        )

        if not ctx.get("date") and _looks_like_datetime:

            booking_date = normalize_date(user_message)
            if booking_date:
                ctx["date"] = booking_date
                ctx["state"] = "DATE_SELECTED"

        elif ctx.get("date") and not ctx.get("time_slot") and _looks_like_datetime:

            time_slot = normalize_time_slot(user_message)
            if time_slot:
                ctx["time_slot"] = time_slot
                ctx["state"] = "WAIT_NAME"


    for _ in range(5):
        if session is not None and messages and messages[0]["role"] == "system":
            messages[0]["content"] = _render_system_prompt(session["booking_context"])

        response = chat(model=MODEL, messages=messages, tools=TOOLS_SCHEMA)
        msg = response["message"]
        content = msg.get("content") or ""
        tool_calls = msg.get("tool_calls")


        if not tool_calls and content.strip().startswith("{") and content.strip().endswith("}"):
            try:
                data = json.loads(content.strip())
                if isinstance(data, dict) and ("name" in data or "function" in data):
                    name = data.get("name") or data.get("function")
                    if isinstance(name, dict):
                        name = name.get("name")
                    args = data.get("parameters") or data.get("arguments") or {}
                    name_str = str(name).strip().lower().replace(" ", "_").replace("-", "_")
                    name = {
                        "book_appointment": "book_slot", "book": "book_slot",
                        "cancel_booking": "cancel_appointment", "cancel": "cancel_appointment",
                        "get_slots": "get_available_slots", "check_slots": "get_available_slots",
                        "slots": "get_available_slots",
                    }.get(name_str, name_str)
                    tool_calls = [{"function": {"name": name, "arguments": args}}]
                    msg["tool_calls"] = tool_calls
                    msg["content"] = ""
            except Exception:
                pass


        if not tool_calls and content.strip() and _CANCEL_CONFIRM_PATTERN.search(content):
            content = 'Could you confirm the date and time of the appointment you would like to cancel? For example: "16 July 2026, 15:00".'
            messages.append({"role": "assistant", "content": content})
            return content


        if not tool_calls:
            messages.append(msg)
            content = msg.get("content") or ""
            if not content.strip():
                content = "Could you tell me a bit more about what you'd like to do?"
                messages[-1] = {"role": "assistant", "content": content}
            return content

        messages.append(msg)

        for call in tool_calls:
            name = call["function"]["name"]
            args = call["function"].get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}

            if "date" in args:
                args["date"] = normalize_date(args["date"])
            if "time_slot" in args:
                args["time_slot"] = normalize_time_slot(args["time_slot"])

            ctx = session["booking_context"] if session is not None else {}


            if session is not None:
                if args.get("date"):
                    ctx["date"] = args["date"]
                    ctx["state"] = "DATE_SELECTED"

                if args.get("time_slot"):
                    ctx["time_slot"] = args["time_slot"]
                    ctx["state"] = "TIME_SELECTED"

                if args.get("patient_name"):
                    ctx["patient_name"] = args["patient_name"]
                    ctx["state"] = "NAME_COLLECTED"

                if args.get("problem"):
                    ctx["problem"] = args["problem"]
                    ctx["state"] = "READY_TO_BOOK"

            if name == "book_slot" and session is not None:
                ctx = session["booking_context"]
                for k in ("date", "time_slot"):
                    args[k] = (ctx.get(k) if _is_valid_param(ctx.get(k)) else None) or args.get(k)
                for k in ("patient_name", "problem"):
                    args[k] = args.get(k) if _is_valid_param(args.get(k)) else ctx.get(k)
                if session.get("username"):
                    args["username"] = session["username"]


            if name == "book_slot" and session is not None:
                ctx = session["booking_context"]

                if ctx.get("date") is None:
                    messages.append({"role": "tool", "name": name, "tool_name": name,
                                     "content": json.dumps({"error": True, "message": "What date would you like to book?"})})
                    messages.append({"role": "assistant", "content": "What date would you like to book?"})
                    return "What date would you like to book?"

                if ctx.get("time_slot") is None:
                    messages.append({"role": "tool", "name": name, "tool_name": name,
                                     "content": json.dumps({"error": True, "message": "What time slot would you like to book?"})})
                    messages.append({"role": "assistant", "content": "What time slot would you like to book?"})
                    return "What time slot would you like to book?"


                if ctx.get("time_slot") and ctx["time_slot"] not in VALID_CLINIC_SLOTS:
                    bad_slot = ctx["time_slot"]

                    ctx["time_slot"] = None
                    ctx["state"] = "DATE_SELECTED"
                    args["time_slot"] = None
                    valid_list = ", ".join(VALID_CLINIC_SLOTS)
                    reply = (
                        f"'{bad_slot}' is not a valid clinic slot.\n\n"
                        f"Available slots are:\n"
                        + "\n".join(f"- {s}" for s in VALID_CLINIC_SLOTS)
                        + "\n\nWhat time slot would you like to book?"
                    )
                    messages.append({"role": "tool", "name": name, "tool_name": name,
                                     "content": json.dumps({"error": True, "message": reply})})
                    messages.append({"role": "assistant", "content": reply})
                    return reply


                if ctx.get("patient_name") is None:
                    messages.append({"role": "tool", "name": name, "tool_name": name,
                                     "content": json.dumps({"error": True, "message": "What is the patient's full name?"})})
                    messages.append({"role": "assistant", "content": "What is the patient's full name?"})
                    return "What is the patient's full name?"

                if ctx.get("problem") is None:
                    messages.append({"role": "tool", "name": name, "tool_name": name,
                                     "content": json.dumps({"error": True, "message": "Could you please specify the problem or reason for the visit?"})})
                    messages.append({"role": "assistant", "content": "Could you please specify the problem or reason for the visit?"})
                    return "Could you please specify the problem or reason for the visit?"


            missing = _get_missing_params(name, args)
            if missing:
                raw_result = json.dumps({
                    "error": True,
                    "message": f"Missing or invalid parameters: {', '.join(missing)}. Ask the user for them.",
                })
            else:
                func = AVAILABLE_FUNCTIONS.get(name)
                if func is None:
                    raw_result = json.dumps({"error": True, "message": f"Tool '{name}' is not available."})
                else:
                    try:
                        raw_result = func(**args)
                    except Exception as e:
                        raw_result = json.dumps({"error": True, "message": str(e)})


            if name == "get_available_slots":
                try:
                    slot_data = json.loads(raw_result)
      
                    if slot_data.get("error") or slot_data.get("detail"):
                        no_slots_reply = "No slots available at this time."
                        messages.append({"role": "tool", "name": name, "tool_name": name,
                                         "content": json.dumps({"error": True, "message": no_slots_reply})})
                        messages.append({"role": "assistant", "content": no_slots_reply})
                        return no_slots_reply

                    if slot_data.get("available_count", -1) == 0:
                        no_slots_reply = "No slots available at this time."
                        messages.append({"role": "tool", "name": name, "tool_name": name,
                                         "content": json.dumps({"available_count": 0, "message": no_slots_reply})})
                        messages.append({"role": "assistant", "content": no_slots_reply})
                        return no_slots_reply
                except (json.JSONDecodeError, AttributeError):
                    pass
   

            messages.append({"role": "tool", "name": name, "tool_name": name, "content": raw_result})


            if name == "cancel_appointment":
                try:
                    result = json.loads(raw_result)
                except json.JSONDecodeError:
                    result = {"error": True}
                if not result.get("error"):
                    cdate = args.get("date")
                    ctime = args.get("time_slot")
                    reply = f"Your appointment for {cdate} at {ctime} has been successfully cancelled."
                else:
                    reply = _tool_error_message(result)
                messages.append({"role": "assistant", "content": reply})
                return reply


            if session is not None:
                if name in ("get_available_slots", "book_slot"):

                    if name == "get_available_slots" and args.get("date"):
                        if session["booking_context"].get("date") and args["date"] != session["booking_context"]["date"]:
                            session["booking_context"]["time_slot"] = None
                            session["booking_context"]["patient_name"] = None
                            session["booking_context"]["problem"] = None
                    for k in BOOKING_FIELDS:
                        if _is_valid_param(args.get(k)):
                            session["booking_context"][k] = args[k]

                if name == "book_slot":
                    try:
                        result = json.loads(raw_result)
                        if not result.get("error"):
                            session["booking_context"] = {k: None for k in BOOKING_FIELDS}
                            session["booking_context"]["state"] = "IDLE"
                    except json.JSONDecodeError:
                        pass



    return "I am processing too many requests at the moment. Please try again."


if __name__ == "__main__":
    msgs = new_conversation()
    sess = {"username": None}
    print("MedSync agent ready. Type 'quit' to exit.")
    while True:
        try:
            user_in = input("You: ")
        except EOFError:
            break
        if user_in.strip().lower() in ("quit", "exit"):
            break
        msgs.append({"role": "user", "content": user_in})
        reply = run_agent_turn(msgs, sess)
        print(f"Assistant: {reply}\n")