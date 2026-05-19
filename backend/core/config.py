from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    # 1. Variables that MUST be in your .env
    DATABASE_URL: str
    MONGO_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    GROQ_API_KEY: str  # Pydantic will look for GROQ_API_KEY in .env

    # 2. Variables with default values
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    APP_NAME: str = "AI Recruitment Platform"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:5173"
    
    # 3. Embedding config
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384

    # 4. Interview Bot Config
    INTERVIEW_MAX_TURNS: int = 12
    INTERVIEW_MEDIA_DIR: str = "interview_media"
    INTERVIEW_MAX_FILE_SIZE_MB: int = 100
    INTERVIEW_TESTING_MODE: bool = False
    GROQ_STT_MODEL: str = "whisper-large-v3-turbo"
    GROQ_LLM_MODEL: str = "llama-3.3-70b-versatile"
    # STT: prompt neutre anti-hallucination (voir stt_antihallucination.py)
    GROQ_STT_PROMPT: str = "Bonjour. Oui. Merci."
    # Sentiment texte du candidat (transformers, chargement lazy)
    INTERVIEW_TEXT_SENTIMENT_ENABLED: bool = True
    INTERVIEW_SENTIMENT_MODEL: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
    
    # RAG Settings
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 200
    RAG_COLLECTION_PREFIX: str = "recruitment"

    # Celery async task settings
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # Email / SMTP (optional)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: Optional[str] = None

    # New way to handle .env files in Pydantic v2
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Ensure interview media directory exists
Path(settings.INTERVIEW_MEDIA_DIR).mkdir(exist_ok=True)