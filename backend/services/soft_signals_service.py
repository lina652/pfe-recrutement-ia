"""
Scores combinés verbal + facial et dissonance émotionnelle.
"""
from typing import Dict, Optional


def _emotion_dist_to_percent(emotion_dist: dict) -> dict:
    if not emotion_dist:
        return {}
    values = list(emotion_dist.values())
    if max(values) <= 1.0:
        return {k: round(float(v) * 100, 2) for k, v in emotion_dist.items()}
    return {k: round(float(v), 2) for k, v in emotion_dist.items()}


def derive_soft_signals(
    emotion_dist: dict,
    sentiment: dict,
    audio_duration: float,
    text_length: int,
    frames_with_face: Optional[int] = None,
    total_frames: Optional[int] = None,
) -> dict:
    wpm = (text_length / audio_duration * 60) if audio_duration > 0 else 0
    engagement_verbal = min(100.0, wpm * 1.5)

    face_reliability = None
    if frames_with_face is not None and total_frames and total_frames > 0:
        face_reliability = frames_with_face / total_frames

    dist = _emotion_dist_to_percent(emotion_dist)

    if not dist or (face_reliability is not None and face_reliability < 0.4):
        return {
            "confidence_score": None,
            "stress_score": None,
            "engagement_score": round(float(engagement_verbal), 1),
            "speech_rate_wpm": round(float(wpm), 1),
            "face_reliability": round(float(face_reliability), 2) if face_reliability is not None else None,
            "emotional_evaluation_skipped": True,
            "skip_reason": "no_face" if not dist else f"low_reliability ({(face_reliability or 0) * 100:.0f}%)",
        }

    emotion_intensity = max(dist.values()) - min(dist.values())
    if emotion_intensity < 20:
        return {
            "confidence_score": 50.0,
            "stress_score": 20.0,
            "engagement_score": round(float(engagement_verbal), 1),
            "speech_rate_wpm": round(float(wpm), 1),
            "face_reliability": round(float(face_reliability), 2) if face_reliability is not None else None,
            "expressiveness": "low",
        }

    confidence = (
        dist.get("happy", 0)
        + dist.get("neutral", 0) * 0.3
        - dist.get("fear", 0) * 0.5
    )
    stress = (
        dist.get("fear", 0) * 0.6
        + dist.get("sad", 0) * 0.4
        + dist.get("angry", 0) * 0.3
    )
    engagement = 0.6 * engagement_verbal + 0.4 * (
        dist.get("happy", 0) + dist.get("surprise", 0)
    )

    return {
        "confidence_score": round(float(max(0, min(100, confidence))), 1),
        "stress_score": round(float(max(0, min(100, stress))), 1),
        "engagement_score": round(float(max(0, min(100, engagement))), 1),
        "speech_rate_wpm": round(float(wpm), 1),
        "face_reliability": round(float(face_reliability), 2) if face_reliability is not None else None,
        "expressiveness": "normal",
    }


def _interpret_dissonance(text_p: float, face_p: float, score: float) -> str:
    if score < 20:
        return "Signal émotionnel cohérent"
    if text_p < 0 and face_p > 0.2:
        return "Propos négatifs mais visage souriant — possible masque social ou inconfort"
    if text_p > 0 and face_p < -0.2:
        return "Propos positifs mais visage tendu — possible stress ou réponse forcée"
    return "Incohérence émotionnelle détectée"


def compute_dissonance_score(sentiment: dict, emotion_distribution: dict) -> dict:
    if not emotion_distribution:
        return {"score": None, "label": "unknown", "details": "Pas de visage détecté"}

    dist = _emotion_dist_to_percent(emotion_distribution)
    sent_label = (sentiment.get("label") or "neutral").lower()
    sent_score = sentiment.get("score", 0.5)

    if "positive" in sent_label or "pos" in sent_label:
        text_polarity = sent_score
    elif "negative" in sent_label or "neg" in sent_label:
        text_polarity = -sent_score
    else:
        text_polarity = 0.0

    positive_emotions = dist.get("happy", 0) + dist.get("surprise", 0)
    negative_emotions = dist.get("angry", 0) + dist.get("sad", 0) + dist.get("fear", 0)
    neutral_emotion = dist.get("neutral", 0)
    total_signal = positive_emotions + negative_emotions + neutral_emotion
    face_polarity = (
        (positive_emotions - negative_emotions) / 100.0 if total_signal else 0.0
    )

    dissonance = min(100.0, max(0.0, abs(text_polarity - face_polarity) * 50))

    if dissonance < 20:
        label = "coherent"
    elif dissonance < 50:
        label = "mild_dissonance"
    else:
        label = "strong_dissonance"

    return {
        "score": round(float(dissonance), 1),
        "label": label,
        "details": {
            "text_polarity": round(text_polarity, 2),
            "face_polarity": round(face_polarity, 2),
            "interpretation": _interpret_dissonance(text_polarity, face_polarity, dissonance),
        },
    }
