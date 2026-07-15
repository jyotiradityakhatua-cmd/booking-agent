import requests
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Data


class GetAvailableSlotsComponent(Component):
    display_name = "Get Available Slots"
    description = (
        "Fetch every clinic slot for a given date (YYYY-MM-DD) along with "
        "whether each slot is available or already booked. Call this "
        "immediately after the user tells you which date they want."
    )
    icon = "calendar-search"
    name = "GetAvailableSlots"

    inputs = [
        MessageTextInput(
            name="date",
            display_name="Date",
            info="Date to check, format YYYY-MM-DD",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="api_base_url",
            display_name="API Base URL",
            value="http://localhost:8000",
            info="Base URL of the Clinic Booking FastAPI service",
            advanced=True,
        ),
    ]

    outputs = [
        Output(display_name="Slots", name="slots", method="get_slots"),
    ]

    def get_slots(self) -> Data:
        base_url = (self.api_base_url or "http://localhost:8000").rstrip("/")
        try:
            resp = requests.get(f"{base_url}/slots", params={"date": self.date}, timeout=10)
            resp.raise_for_status()
            result = resp.json()
        except requests.exceptions.HTTPError as e:
            result = {"error": True, "status_code": e.response.status_code, "detail": e.response.json()}
        except requests.exceptions.RequestException as e:
            result = {"error": True, "detail": str(e)}

        data = Data(data=result)
        self.status = result
        return data
