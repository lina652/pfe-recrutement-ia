import base64
import logging
import mimetypes

from groq import Groq

from core.config import settings

logger = logging.getLogger(__name__)

# PaddleOCR 3.x does not register "latin"; French model uses latin script recognition.
OCR_LANG_ALIASES = {
    "latin": "fr",
}


def resolve_ocr_lang(lang: str) -> str:
    key = (lang or "fr").lower().strip()
    return OCR_LANG_ALIASES.get(key, key)


def groq_extract_text_from_image(image_bytes: bytes, filename: str) -> str:
    """Fallback OCR for PNG/JPG CVs when PaddleOCR fails or returns too little text."""
    mime, _ = mimetypes.guess_type(filename or "")
    if not mime or not mime.startswith("image/"):
        lower = (filename or "").lower()
        if lower.endswith(".png"):
            mime = "image/png"
        elif lower.endswith(".webp"):
            mime = "image/webp"
        else:
            mime = "image/jpeg"

    b64 = base64.b64encode(image_bytes).decode("ascii")
    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model=settings.GROQ_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Extract ALL readable text from this CV/resume image. "
                            "Return plain text only (no markdown), preserving sections "
                            "such as name, email, phone, skills, experience, and education."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }
        ],
        temperature=0,
    )
    text = (response.choices[0].message.content or "").strip()
    logger.info("Groq vision extracted %d characters from %s", len(text), filename)
    return text
