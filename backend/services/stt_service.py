"""
Speech-to-Text service using Groq Whisper API (no GPU required).
"""
import logging
from pathlib import Path
from openai import OpenAI
from core.config import settings

logger = logging.getLogger(__name__)


class STTService:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1"
        )
        self.model = settings.GROQ_STT_MODEL  # whisper-large-v3-turbo

    def transcribe(self, audio_file_path: str, language: str = None) -> dict:
        """
        Transcribe audio file to text using Groq Whisper API.
        
        Args:
            audio_file_path: Path to audio file (.wav, .mp3, .webm, .ogg)
            language: Language code (e.g., 'en', 'fr'). If None, auto-detect.
        
        Returns:
            {
                "text": "transcribed text",
                "language": "detected or specified language",
                "duration": duration_in_seconds
            }
        """
        try:
            audio_path = Path(audio_file_path)
            if not audio_path.exists():
                logger.error(f"Audio file not found: {audio_file_path}")
                raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

            file_size_mb = audio_path.stat().st_size / (1024 * 1024)
            if file_size_mb > 25:  # Groq free tier limit
                logger.error(f"Audio file too large: {file_size_mb}MB (max 25MB)")
                raise ValueError(f"Audio file too large: {file_size_mb}MB (max 25MB)")

            with open(audio_file_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    language=language,  # Optional: force language detection
                    response_format="json"
                )

            logger.info(f"Transcribed audio: {audio_file_path}")
            return {
                "text": transcript.text,
                "language": transcript.language if hasattr(transcript, 'language') else language,
            }

        except Exception as e:
            logger.error(f"STT error: {str(e)}")
            raise


# Singleton instance
_stt_service = None


def get_stt_service() -> STTService:
    global _stt_service
    if _stt_service is None:
        _stt_service = STTService()
    return _stt_service
