import fitz
import numpy as np
import io
import logging
import os
from PIL import Image, ImageOps

from core.config import settings
from services.groq_vision_service import resolve_ocr_lang

logger = logging.getLogger(__name__)

# Avoid Paddle oneDNN crashes on some Windows setups.
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")


class OCRService:
    def __init__(self):
        self._ocr = None
        self._lang = resolve_ocr_lang(settings.OCR_LANG)

    def _get_ocr(self):
        if self._ocr is None:
            from paddleocr import PaddleOCR

            logger.info("Initializing PaddleOCR (lang=%s)...", self._lang)
            self._ocr = PaddleOCR(
                lang=self._lang,
                enable_mkldnn=False,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=True,
            )
        return self._ocr

    @staticmethod
    def _parse_predict_result(result) -> str:
        if not result:
            return ""

        texts: list[str] = []
        for page in result:
            if isinstance(page, dict):
                texts.extend(str(t).strip() for t in (page.get("rec_texts") or []) if str(t).strip())
                continue

            if isinstance(page, list):
                for line in page:
                    if not line or len(line) < 2:
                        continue
                    payload = line[1]
                    if isinstance(payload, (list, tuple)) and payload:
                        texts.append(str(payload[0]).strip())
                    elif isinstance(payload, str):
                        texts.append(payload.strip())
        return " ".join(texts)

    def _ocr_numpy(self, img_np: np.ndarray) -> str:
        engine = self._get_ocr()
        try:
            result = engine.predict(img_np)
            text = self._parse_predict_result(result)
            if text.strip():
                return text
        except Exception as exc:
            logger.warning("PaddleOCR predict failed: %s", exc)

        try:
            result = engine.ocr(img_np)
            return self._parse_predict_result(result)
        except Exception as exc:
            logger.warning("PaddleOCR ocr fallback failed: %s", exc)
            return ""

    @staticmethod
    def _prepare_image(image_bytes: bytes) -> np.ndarray:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img)
        if img.mode != "RGB":
            img = img.convert("RGB")

        width, height = img.size
        longest = max(width, height)
        if longest > 2400:
            scale = 2400 / longest
            img = img.resize((int(width * scale), int(height * scale)), Image.Resampling.LANCZOS)
        elif longest < 1200:
            scale = 1200 / longest
            img = img.resize((int(width * scale), int(height * scale)), Image.Resampling.LANCZOS)

        return np.array(img)

    def extract_text(self, pdf_path: str) -> str:
        """Extrait le texte d'un PDF."""
        doc = fitz.open(pdf_path)
        full_text = ""

        for page in doc:
            text = page.get_text()

            if len(text.strip()) > 50:
                full_text += text
            else:
                pix = page.get_pixmap(dpi=300)
                img_np = np.array(Image.open(io.BytesIO(pix.tobytes("png"))))
                full_text += self._ocr_numpy(img_np)

        doc.close()
        return full_text

    def extract_text_from_image_bytes(self, image_bytes: bytes) -> str:
        """OCR for uploaded PNG/JPG/JPEG/WebP CV images."""
        return self._ocr_numpy(self._prepare_image(image_bytes))

    def extract_text_from_bytes(self, pdf_bytes: bytes) -> str:
        """Extrait le texte depuis des bytes (pour les uploads)."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""

        for page in doc:
            text = page.get_text()

            if len(text.strip()) > 50:
                full_text += text
            else:
                pix = page.get_pixmap(dpi=300)
                img_np = np.array(Image.open(io.BytesIO(pix.tobytes("png"))))
                full_text += self._ocr_numpy(img_np)

        doc.close()
        return full_text


# Singleton
ocr_service = OCRService()
