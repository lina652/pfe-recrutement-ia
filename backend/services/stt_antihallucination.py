"""
Post-traitement anti-hallucination pour transcriptions (Groq Whisper ou faster-whisper).
"""
from collections import Counter
from typing import Optional

# Prompt stylistique neutre — pas de contenu réutilisable par le modèle
NEUTRAL_WHISPER_PROMPT = "Bonjour. Oui. Merci."


def sanitize_transcript(
    full_text: str,
    *,
    initial_prompt: str = NEUTRAL_WHISPER_PROMPT,
    language_probability: Optional[float] = None,
    min_language_probability: float = 0.4,
) -> dict:
    """
    Filets de sécurité après STT (couche 3 Colab + filtre répétitions).
    Retourne texte nettoyé + métadonnées optionnelles.
    """
    text = (full_text or "").strip()
    warning = None

    if text:
        prompt_norm = initial_prompt.lower().strip(".!?")
        text_norm = text.lower().strip(".!?")
        if text_norm == prompt_norm:
            text = ""
        elif len(text.split()) <= len(initial_prompt.split()) + 2:
            prompt_words = set(initial_prompt.lower().replace(".", "").split())
            text_words = set(text.lower().replace(".", "").replace(",", "").split())
            if text_words:
                overlap = len(prompt_words & text_words) / len(text_words)
                if overlap > 0.8:
                    text = ""

        words = text.split()
        if len(words) > 10:
            word_counts = Counter(w.lower() for w in words)
            most_common = word_counts.most_common(1)[0][1]
            if most_common / len(words) > 0.4:
                text = ""

    if language_probability is not None and language_probability < min_language_probability:
        text = ""
        warning = "Parole non détectée ou langue incompatible"

    if not text:
        warning = warning or "Parole non détectée ou transcription vide"

    return {
        "text": text,
        "warning": warning,
    }
