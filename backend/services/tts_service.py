"""
Text-to-Speech service using edge-tts (free, no API key required).
"""
import logging
import asyncio
from pathlib import Path
import edge_tts
from core.config import settings

logger = logging.getLogger(__name__)

# Voice mapping for different languages
VOICE_MAP = {
    "en": "en-US-JennyNeural",
    "fr": "fr-FR-DeniseNeural",
    "es": "es-ES-AlvaroNeural",
    "de": "de-DE-ConradNeural",
    "it": "it-IT-IsabellaNeural",
}


class TTSService:
    def __init__(self):
        self.media_dir = Path(settings.INTERVIEW_MEDIA_DIR)
        self.media_dir.mkdir(exist_ok=True)

    async def synthesize(self, text: str, language: str = "en") -> str:
        """
        Synthesize text to speech using edge-tts.
        
        Args:
            text: Text to convert to speech
            language: Language code (en, fr, es, de, it)
        
        Returns:
            Path to generated .mp3 file
        """
        try:
            voice = VOICE_MAP.get(language, VOICE_MAP["en"])
            
            # Generate unique filename
            import uuid
            output_file = self.media_dir / f"tts_{uuid.uuid4()}.mp3"
            
            # Use edge-tts to synthesize
            communicate = edge_tts.Communicate(text=text, voice=voice)
            await communicate.save(str(output_file))
            
            logger.info(f"Generated TTS audio: {output_file} (voice: {voice})")
            return str(output_file)
        
        except Exception as e:
            logger.error(f"TTS error: {str(e)}")
            raise

    def synthesize_sync(self, text: str, language: str = "en") -> str:
        """
        Synchronous wrapper for synthesize (using asyncio.run).
        """
        return asyncio.run(self.synthesize(text, language))


# Singleton instance
_tts_service = None


def get_tts_service() -> TTSService:
    global _tts_service
    if _tts_service is None:
        _tts_service = TTSService()
    return _tts_service
