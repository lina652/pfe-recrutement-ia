"""
Interview language compliance: detect wrong-language answers and score penalties.
"""
import re
from typing import Dict, Optional

# High-frequency function words (not shared much between EN/FR)
_FR_MARKERS = {
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles",
    "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux",
    "et", "est", "sont", "été", "être", "avoir", "ai", "as", "avez", "ont",
    "pour", "avec", "dans", "sur", "pas", "que", "qui", "quoi", "où",
    "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre",
    "très", "bien", "merci", "bonjour", "oui", "non", "ça", "ce", "cette", "ces",
    "plus", "tout", "tous", "comme", "mais", "donc", "car", "parce", "peut", "peux",
    "faire", "fait", "été", "avoir", "chez", "également", "aussi", "alors",
}

_EN_MARKERS = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "can",
    "i", "you", "he", "she", "we", "they", "my", "your", "our", "their", "his", "her", "its",
    "this", "that", "these", "those", "with", "for", "from", "about", "into", "through",
    "not", "no", "yes", "thank", "thanks", "hello", "hi", "because", "what", "when", "how",
    "who", "which", "where", "why", "work", "worked", "working", "experience", "also", "very",
    "well", "good", "really", "just", "more", "most", "some", "any", "all", "than", "then",
}


def _normalize_lang(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    c = str(code).lower().strip()[:2]
    return c if c in ("en", "fr") else None


def detect_spoken_language(transcript: str) -> tuple[Optional[str], float]:
    """
    Lightweight heuristic detector for French vs English.
    Returns (lang_code, confidence 0-1) or (None, 0) if uncertain.
    """
    if not transcript or len(transcript.strip()) < 8:
        return None, 0.0

    words = re.findall(r"[a-zA-ZÀ-ÿ']+", transcript.lower())
    if len(words) < 4:
        return None, 0.0

    fr_hits = sum(1 for w in words if w in _FR_MARKERS)
    en_hits = sum(1 for w in words if w in _EN_MARKERS)

    # French accented characters strongly indicate French
    if re.search(r"[àâäæçéèêëïîôùûüœ]", transcript.lower()):
        fr_hits += 2

    total_hits = fr_hits + en_hits
    if total_hits < 2:
        return None, 0.0

    fr_ratio = fr_hits / len(words)
    en_ratio = en_hits / len(words)

    if fr_hits >= en_hits + 2 and fr_ratio >= 0.12:
        conf = min(0.95, 0.5 + fr_ratio)
        return "fr", conf
    if en_hits >= fr_hits + 2 and en_ratio >= 0.12:
        conf = min(0.95, 0.5 + en_ratio)
        return "en", conf
    return None, 0.0


def detect_language_mismatch(
    transcript: str,
    expected_language: str,
    stt_detected_language: Optional[str] = None,
) -> Dict:
    """
    True when the candidate's answer is clearly not in the interview language.
    """
    expected = _normalize_lang(expected_language) or "en"
    detected, confidence = detect_spoken_language(transcript)

    stt_lang = _normalize_lang(stt_detected_language)
    if stt_lang and stt_lang != expected and confidence < 0.6:
        detected = stt_lang
        confidence = max(confidence, 0.65)

    if not detected:
        return {
            "mismatch": False,
            "expected": expected,
            "detected": None,
            "confidence": 0.0,
        }

    mismatch = detected != expected
    return {
        "mismatch": mismatch,
        "expected": expected,
        "detected": detected,
        "confidence": round(confidence, 2),
    }


def language_warning_message(
    interview_language: str,
    mismatch_count: int,
    check: Dict,
) -> str:
    """Bot remark when the candidate speaks the wrong language."""
    expected = check.get("expected") or interview_language
    detected = (check.get("detected") or "?").upper()
    lang_name = {"fr": "French", "en": "English"}.get(expected, expected)
    lang_name_fr = {"fr": "français", "en": "anglais"}.get(expected, expected)

    if interview_language == "fr":
        if mismatch_count <= 1:
            return (
                f"Je remarque que vous répondez plutôt en {detected}. "
                f"Cet entretien se déroule en {lang_name_fr}, comme vous l'avez choisi. "
                f"Merci de continuer en {lang_name_fr} pour que l'évaluation soit équitable."
            )
        return (
            f"Vous continuez à répondre en {detected} au lieu du {lang_name_fr} choisi. "
            f"Cela sera pris en compte dans votre évaluation. "
            f"Merci de répondre en {lang_name_fr} dès maintenant."
        )

    if mismatch_count <= 1:
        return (
            f"I notice you're answering mainly in {detected}. "
            f"This interview is conducted in {lang_name}, as you selected. "
            f"Please continue in {lang_name} so we can evaluate you fairly."
        )
    return (
        f"You're still responding in {detected} instead of the selected {lang_name}. "
        f"This will lower your interview rating. "
        f"Please answer in {lang_name} from now on."
    )


def language_score_penalty(mismatch_turn_count: int) -> int:
    """
    Points deducted from overall_score (0-100) based on wrong-language turns.
    1st turn: no penalty yet (warning only). 2+: escalating penalty.
    """
    if mismatch_turn_count <= 1:
        return 0
    # 2nd mismatch: -10, 3rd: -18, 4+: up to -30 cap
    extra = mismatch_turn_count - 1
    return min(30, 10 + (extra - 1) * 8)


def language_penalty_summary(mismatch_turn_count: int, penalty: int) -> str:
    if mismatch_turn_count <= 0:
        return ""
    return (
        f"Candidate answered in the wrong language on {mismatch_turn_count} turn(s); "
        f"overall score reduced by {penalty} point(s)."
    )
