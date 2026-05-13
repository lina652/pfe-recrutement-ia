import sys
sys.path.append('c:/Users/LENOVO/Desktop/pfe/AI recruitment/backend')
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import settings
import traceback

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

from services.interview_service import get_interview_service
service = get_interview_service()

try:
    service.process_turn(db=db, interview_id='2cb3134b-fd1e-4f43-b426-c4f831a99b89', audio_webm_path='test.webm')
except Exception as e:
    print('ERRORRRR')
    traceback.print_exc()
