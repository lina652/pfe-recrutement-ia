"""
Speech-to-Text service using Groq Whisper API (no GPU required).
Anti-hallucination: prompt neutre + post-traitement (compatible logique Colab).
"""
import logging
from pathlib import Path
from openai import OpenAI
from core.config import settings
from services.stt_antihallucination import NEUTRAL_WHISPER_PROMPT, sanitize_transcript

logger = logging.getLogger(__name__)


class STTService:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = settings.GROQ_STT_MODEL

    def transcribe(self, audio_file_path: str, language: str = None) -> dict:
        """
        Transcribe audio via Groq Whisper, puis filtre anti-hallucination.

        Returns:
            {
                "text": str,
                "language": str | None,
                "warning": str | None,
                "raw_text": str | None,
            }
        """
        audio_path = Path(audio_file_path)
        if not audio_path.exists():
            logger.error("Audio file not found: %s", audio_file_path)
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        if file_size_mb > 25:
            raise ValueError(f"Audio file too large: {file_size_mb}MB (max 25MB)")

        prompt = settings.GROQ_STT_PROMPT or NEUTRAL_WHISPER_PROMPT
        kwargs = {
            "model": self.model,
            "response_format": "json",
            "prompt": prompt,
            "temperature": 0,
        }
        if language:
            kwargs["language"] = language

        with open(audio_file_path, "rb") as audio_file:
            transcript = self.client.audio.transcriptions.create(
                file=audio_file,
                **kwargs,
            )

        raw_text = (transcript.text or "").strip()
        detected_lang = getattr(transcript, "language", None) or language

        cleaned = sanitize_transcript(
            raw_text,
            initial_prompt=prompt,
            language_probability=None,
        )
        if cleaned["text"]:
            cleaned["warning"] = None

        logger.info(
            "Transcribed %s (%d chars raw → %d chars clean)",
            audio_file_path,
            len(raw_text),
            len(cleaned["text"]),
        )

        return {
            "text": cleaned["text"],
            "language": detected_lang,
            "warning": cleaned.get("warning"),
            "raw_text": raw_text if raw_text != cleaned["text"] else None,
        }


_stt_service = None


def get_stt_service() -> STTService:
    global _stt_service
    if _stt_service is None:
        _stt_service = STTService()
    return _stt_service
