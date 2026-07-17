from typing import Optional
from pydantic import BaseModel, Field


class SlotInfo(BaseModel):
    time_slot: str
    available: bool


class SlotsResponse(BaseModel):
    date: str
    clinic_hours: str
    total_slots: int
    available_count: int
    booked_count: int
    slots: list[SlotInfo]


class BookingRequest(BaseModel):
    date: str = Field(
        ...,
        description="Date already normalized by the agent to YYYY-MM-DD.",
    )
    time_slot: str = Field(..., description="Time slot in HH:MM format, e.g. 09:30")
    problem: str = Field(..., min_length=3, description="Patient's general problem / reason for visit")
    patient_name: str = Field(..., min_length=2, description="Patient's full name")
    username: Optional[str] = Field(None, description="Owner of the booking")


class BookingResponse(BaseModel):
    id: int
    date: str
    time_slot: str
    patient_name: Optional[str]
    problem: str
    created_at: str
    message: str
    username: Optional[str] = None


class BookingConflict(BaseModel):
    error: str
    message: str
    requested_date: str
    requested_time_slot: str
    alternative_slots_same_date: list[str]


class CancelResponse(BaseModel):
    message: str
    id: int


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str
    password: str
    email: str


class SessionInfo(BaseModel):
    session_id: str
    username: str
    title: str
    updated_at: str
    booking_context: Optional[dict] = None
