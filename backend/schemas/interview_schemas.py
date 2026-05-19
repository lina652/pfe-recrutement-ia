"""
Pydantic schemas for Interview and RAG APIs.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


# ==================== INTERVIEW SCHEMAS ====================

class InterviewCreate(BaseModel):
    application_id: str
    candidate_id: str
    job_id: str


class InterviewInviteRequest(BaseModel):
    application_id: str
    scheduled_at: datetime
    meeting_link: Optional[str] = None
    language: str = Field(default="en", pattern="^(en|fr)$")


class InterviewInviteResponse(BaseModel):
    interview_id: str
    status: str
    application_id: str
    scheduled_at: datetime
    meeting_link: Optional[str] = None


class InterviewCandidateResponseRequest(BaseModel):
    action: str  # "ACCEPTED" or "REFUSED"
    reason: Optional[str] = None


class ProposeTimeRequest(BaseModel):
    availability_comment: str = Field(..., max_length=2000)


class InterviewLanguageUpdate(BaseModel):
    language: str = Field(..., pattern="^(en|fr)$")


class InterviewMessageItem(BaseModel):
    role: str
    content: str
    audio_url: Optional[str] = None
    turn_number: Optional[int] = None


class InterviewCandidateDetail(BaseModel):
    interview_id: str
    application_id: str
    job_id: str
    language: str
    status: str
    scheduled_at: Optional[datetime] = None
    meeting_link: Optional[str] = None
    candidate_response: Optional[str] = None
    candidate_response_reason: Optional[str] = None
    candidate_responded_at: Optional[datetime] = None
    auto_scheduled: bool = False
    candidate_availability_comment: Optional[str] = None
    phase: Optional[str] = None
    turn_count: Optional[int] = None
    messages: List[InterviewMessageItem] = []


class InterviewStart(BaseModel):
    language: str = Field(default="en", pattern="^(en|fr)$")


class InterviewTurnRequest(BaseModel):
    audio_file_path: str
    video_file_path: Optional[str] = None


class InterviewMessageResponse(BaseModel):
    turn: int
    phase: str
    candidate_transcript: str
    bot_response: str
    audio_url: str
    signals: Dict = {}
    should_end: bool


class InterviewScoreResponse(BaseModel):
    overall_score: float
    communication_score: float
    technical_score: float
    motivation_score: float


class InterviewReportResponse(BaseModel):
    overall_score: float
    communication_score: float
    technical_score: float
    motivation_score: float
    recommendation: str
    strengths: List[str]
    weaknesses: List[str]
    # Additional fields from bot_rh_final_v2
    technical_competencies: List[str] = []
    soft_skills: Dict = {}
    red_flags: List[str] = []
    follow_up_questions: List[str] = []
    summary: str


class InterviewListItem(BaseModel):
    interview_id: str
    candidate_name: str
    job_title: str
    status: str
    language: str
    created_at: datetime
    scheduled_at: Optional[datetime] = None
    meeting_link: Optional[str] = None
    candidate_response: Optional[str] = None
    candidate_response_reason: Optional[str] = None
    completed_at: Optional[datetime] = None
    phase: str
    turn_count: Optional[int] = None


class InterviewDetail(BaseModel):
    interview_id: str
    application_id: str
    candidate_id: str
    job_id: str
    language: str
    status: str
    phase: str
    turn_count: int
    created_at: datetime
    scheduled_at: Optional[datetime] = None
    meeting_link: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# ==================== TIME SLOT SCHEMAS ====================

class TimeSlot(BaseModel):
    datetime: datetime
    formatted: str
    available: bool = True


class TimeSlotListResponse(BaseModel):
    interview_id: str
    job_title: str
    slots: List[TimeSlot]
    week_start: datetime
    week_end: datetime


class SelectTimeSlotRequest(BaseModel):
    selected_datetime: datetime
    language: Optional[str] = Field(default=None, pattern="^(en|fr)$")


class SelectTimeSlotResponse(BaseModel):
    message: str
    interview_id: str
    scheduled_at: datetime
    meeting_link: str


# ==================== RAG SCHEMAS ====================

class RAGChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    job_id: str


class RAGChatResponse(BaseModel):
    question: str
    answer: str
    job_id: str


class RAGJobInfo(BaseModel):
    job_id: str
    title: str
    application_count: int
    completed_interview_count: int
