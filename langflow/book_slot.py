import requests
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Data


class BookSlotComponent(Component):
    display_name = "Book Slot"
    description = (
        "Book a clinic slot for a patient. Requires date (YYYY-MM-DD), "
        "time_slot (HH:MM), and problem (the patient's stated reason for "
        "visiting). Only call this after the user has confirmed the exact "
        "date, exact time slot, and told you their problem. Returns an "
        "error with alternative slots if the requested slot is already "
        "booked by someone else on that date."
    )
    icon = "calendar-check"
    name = "BookSlot"

    inputs = [
        MessageTextInput(name="date", display_name="Date", info="YYYY-MM-DD", required=True, tool_mode=True),
        MessageTextInput(name="time_slot", display_name="Time Slot", info="HH:MM, e.g. 10:30", required=True, tool_mode=True),
        MessageTextInput(name="problem", display_name="Problem", info="Patient's general problem / reason for visit", required=True, tool_mode=True),
        MessageTextInput(name="patient_name", display_name="Patient Name", info="Optional patient name", required=False, tool_mode=True),
        MessageTextInput(
            name="api_base_url",
            display_name="API Base URL",
            value="http://localhost:8000",
            info="Base URL of the Clinic Booking FastAPI service",
            advanced=True,
        ),
    ]

    outputs = [
        Output(display_name="Booking Result", name="booking_result", method="book"),
    ]

    def book(self) -> Data:
        base_url = (self.api_base_url or "http://localhost:8000").rstrip("/")
        payload = {
            "date": self.date,
            "time_slot": self.time_slot,
            "problem": self.problem,
            "patient_name": getattr(self, "patient_name", None) or None,
        }
        try:
            resp = requests.post(f"{base_url}/book", json=payload, timeout=10)
            resp.raise_for_status()
            result = resp.json()
        except requests.exceptions.HTTPError as e:
            # Includes the 409 conflict payload with alternative slots
            result = {"error": True, "status_code": e.response.status_code, "detail": e.response.json()}
        except requests.exceptions.RequestException as e:
            result = {"error": True, "detail": str(e)}

        data = Data(data=result)
        self.status = result
        return data
