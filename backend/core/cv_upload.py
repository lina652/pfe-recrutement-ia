"""Shared CV upload validation and text extraction."""

import io
import logging
import re

CV_ALLOWED_EXTENSIONS = (".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp")

CV_ACCEPTED_MESSAGE = (
    "PDF, DOC, DOCX, PNG, JPG, and JPEG files are accepted"
)

MIN_CV_TEXT_CHARS = 30

logger = logging.getLogger(__name__)


def is_allowed_cv_filename(filename: str | None) -> bool:
    if not filename:
        return False
    return filename.lower().endswith(CV_ALLOWED_EXTENSIONS)


def is_cv_image_filename(filename: str) -> bool:
    return filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))


def _extract_docx_text(contents: bytes) -> str:
    import mammoth

    result = mammoth.extract_raw_text(io.BytesIO(contents))
    if result.messages:
        for msg in result.messages:
            logger.debug("mammoth (%s): %s", msg.type, msg.message)
    return (result.value or "").strip()


def _extract_legacy_doc_text(contents: bytes) -> str:
    """Best-effort text extraction from binary .doc (Word 97-2003)."""
    try:
        import olefile

        ole = olefile.OleFileIO(io.BytesIO(contents))
        if ole.exists("WordDocument"):
            raw = ole.openstream("WordDocument").read()
            ascii_runs = re.findall(rb"[\x20-\x7e\r\n\t]{4,}", raw)
            text = " ".join(part.decode("ascii", errors="ignore") for part in ascii_runs)
            if len(text.strip()) >= MIN_CV_TEXT_CHARS:
                return text.strip()
    except Exception as exc:
        logger.warning("Legacy .doc OLE extraction failed: %s", exc)

    ascii_runs = re.findall(rb"[\x20-\x7e]{4,}", contents)
    return " ".join(part.decode("ascii", errors="ignore") for part in ascii_runs).strip()


def extract_cv_text(filename: str, contents: bytes) -> str:
    from services.ocr_service import ocr_service

    lower = filename.lower()
    if lower.endswith(".pdf"):
        return ocr_service.extract_text_from_bytes(contents)
    if lower.endswith(".docx"):
        return _extract_docx_text(contents)
    if lower.endswith(".doc"):
        return _extract_legacy_doc_text(contents)
    if is_cv_image_filename(filename):
        text = ocr_service.extract_text_from_image_bytes(contents)
        if len(text.strip()) >= MIN_CV_TEXT_CHARS:
            return text

        logger.info(
            "PaddleOCR returned %d chars for %s; trying Groq vision fallback",
            len(text.strip()),
            filename,
        )
        from services.groq_vision_service import groq_extract_text_from_image

        try:
            groq_text = groq_extract_text_from_image(contents, filename)
        except Exception as exc:
            logger.warning("Groq vision fallback failed for %s: %s", filename, exc)
            groq_text = ""
        return groq_text or text
    return contents.decode("utf-8", errors="ignore")
