from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON, Enum as SAEnum, ForeignKey, Boolean
from database import Base
from datetime import datetime
import uuid
import enum


class InterviewStatus(str, enum.Enum):
    INVITED = "INVITED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class InterviewPhase(str, enum.Enum):
    INTRO = "intro"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    CLOSING = "closing"
    DONE = "done"


class InterviewRecommendation(str, enum.Enum):
    STRONG_HIRE = "strong_hire"
    HIRE = "hire"
    MAYBE = "maybe"
    NO_HIRE = "no_hire"


class Interview(Base):
    __tablename__ = "interviews"

    interview_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    application_id = Column(String(36), nullable=False, index=True)
    candidate_id = Column(String(36), nullable=False, index=True)
    job_id = Column(String(36), nullable=False, index=True)
    language = Column(String(2), default="en", nullable=False)
    status = Column(
        SAEnum(InterviewStatus),
        default=InterviewStatus.INVITED,
        nullable=False
    )
    phase = Column(
        SAEnum(InterviewPhase),
        default=InterviewPhase.INTRO,
        nullable=False
    )
    turn_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    meeting_link = Column(Text, nullable=True)
    candidate_response = Column(String(20), nullable=True)
    candidate_response_reason = Column(Text, nullable=True)
    candidate_responded_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    auto_scheduled = Column(Boolean, default=False)
    candidate_availability_comment = Column(Text, nullable=True)


class InterviewMessage(Base):
    __tablename__ = "interview_messages"

    message_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    interview_id = Column(String(36), nullable=False, index=True)
    role = Column(String(10), nullable=False)  # "bot" or "candidate"
    content = Column(Text, nullable=False)
    audio_url = Column(Text, nullable=True)
    phase = Column(
        SAEnum(InterviewPhase),
        nullable=False
    )
    turn_number = Column(Integer, nullable=False)
    signals = Column(JSON, nullable=True)  # {emotions, sentiment, confidence, etc.}
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


class InterviewReport(Base):
    __tablename__ = "interview_reports"

    report_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    interview_id = Column(String(36), nullable=False, unique=True, index=True)
    overall_score = Column(Float, nullable=False)  # 0-100
    communication_score = Column(Float, nullable=False)  # 0-10
    technical_score = Column(Float, nullable=False)  # 0-10
    motivation_score = Column(Float, nullable=False)  # 0-10
    recommendation = Column(
        SAEnum(InterviewRecommendation),
        nullable=False
    )
    strengths = Column(JSON, nullable=True)  # list of strings
    weaknesses = Column(JSON, nullable=True)  # list of strings
    # Additional fields from bot_rh_final_v2
    technical_competencies = Column(JSON, nullable=True)  # list of identified technical skills
    soft_skills = Column(JSON, nullable=True)  # dict with communication, teamwork, problem_solving ratings
    red_flags = Column(JSON, nullable=True)  # list of warning signals detected
    follow_up_questions = Column(JSON, nullable=True)  # recommended questions for next interview
    summary = Column(Text, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
