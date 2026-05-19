"""
Analyse de sentiment du texte candidat (complément aux émotions faciales).
"""
import logging
from typing import Optional

from core.config import settings

logger = logging.getLogger(__name__)

_sentiment_pipe = None
_load_failed = False


def _get_pipeline():
    global _sentiment_pipe, _load_failed
    if _load_failed:
        return None
    if _sentiment_pipe is not None:
        return _sentiment_pipe
    try:
        from transformers import pipeline
        import torch

        device = 0 if torch.cuda.is_available() else -1
        _sentiment_pipe = pipeline(
            "sentiment-analysis",
            model=settings.INTERVIEW_SENTIMENT_MODEL,
            device=device,
        )
        logger.info("Sentiment model loaded (%s)", settings.INTERVIEW_SENTIMENT_MODEL)
        return _sentiment_pipe
    except Exception as exc:
        _load_failed = True
        logger.warning("Sentiment model unavailable: %s", exc)
        return None


def analyze_text_sentiment(text: str) -> dict:
    """Label + score sur le transcript candidat."""
    if not text or len(text.strip()) < 3:
        return {"label": "neutral", "score": 0.5}

    if not settings.INTERVIEW_TEXT_SENTIMENT_ENABLED:
        return {"label": "neutral", "score": 0.5, "disabled": True}

    pipe = _get_pipeline()
    if pipe is None:
        return {"label": "neutral", "score": 0.5, "unavailable": True}

    try:
        result = pipe(text[:2000])[0]
        label = result.get("label", "neutral")
        # cardiffnlp: LABEL_0/1/2 ou negative/neutral/positive selon config
        label_map = {
            "LABEL_0": "negative",
            "LABEL_1": "neutral",
            "LABEL_2": "positive",
        }
        normalized = label_map.get(label, label.lower() if isinstance(label, str) else "neutral")
        return {
            "label": normalized,
            "score": round(float(result.get("score", 0.5)), 3),
        }
    except Exception as exc:
        logger.warning("Sentiment analysis failed: %s", exc)
        return {"label": "neutral", "score": 0.5, "error": str(exc)}
