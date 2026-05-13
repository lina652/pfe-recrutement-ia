from sqlalchemy import Column, String, DateTime, Text, Enum as SAEnum
from database import Base
from datetime import datetime
import uuid
import enum


class ReportFormat(str, enum.Enum):
    PDF = "PDF"
    CSV = "CSV"
    JSON = "JSON"


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    title = Column(String(255), nullable=False)
    generated_by = Column(String(36), nullable=False)
    company_id = Column(String(36), nullable=True)
    content = Column(Text, nullable=True)
    format = Column(
        SAEnum(ReportFormat),
        default=ReportFormat.JSON
    )
    generated_at = Column(DateTime, default=datetime.utcnow)
