"""
Vérification d'identité candidat (2 niveaux : avertissement → clôture).
"""
import re
import unicodedata
from typing import Dict, Optional, Tuple


def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^a-zA-Z\s]", " ", name.lower())
    return " ".join(name.split())


def detect_identity_mismatch(transcript: str, expected_name: str) -> Dict:
    if not transcript or not expected_name:
        return {"mismatch": False, "announced_name": None, "confidence": 0.0}

    text_norm = normalize_name(transcript)
    expected_norm = normalize_name(expected_name)
    expected_tokens = set(expected_norm.split())

    patterns = [
        r"je m['\s]appelle\s+([a-z]+(?:\s+[a-z]+){0,2})",
        r"mon nom est\s+([a-z]+(?:\s+[a-z]+){0,2})",
        r"my name is\s+([a-z]+(?:\s+[a-z]+){0,2})",
        r"i am\s+([a-z]+(?:\s+[a-z]+){0,2})",
        r"i['\s]m\s+([a-z]+(?:\s+[a-z]+){0,2})",
    ]

    for pat in patterns:
        match = re.search(pat, text_norm)
        if match:
            announced = match.group(1).strip()
            announced_tokens = set(announced.split())
            common = expected_tokens & announced_tokens
            overlap = len(common) / max(len(expected_tokens), 1)
            return {
                "mismatch": overlap < 0.5,
                "announced_name": announced,
                "expected_name": expected_norm,
                "overlap_ratio": round(overlap, 2),
                "confidence": 0.9 if overlap < 0.3 else 0.6,
            }
    return {"mismatch": False, "announced_name": None, "confidence": 0.0}


def identity_warning_message(language: str, candidate_name: str, identity_check: Dict) -> str:
    announced = (identity_check.get("announced_name") or "").title()
    msgs = {
        "fr": (
            f"Excusez-moi, j'ai cru entendre que vous vous appelez {announced}, "
            f"mais cet entretien est enregistré pour {candidate_name}. "
            f"Peut-être ai-je mal entendu. Pouvez-vous reconfirmer clairement votre nom complet s'il vous plaît ?"
        ),
        "en": (
            f"Excuse me, I thought I heard you say your name is {announced}, "
            f"but this interview is registered for {candidate_name}. "
            f"I may have misheard. Could you please clearly repeat your full name?"
        ),
    }
    return msgs.get(language, msgs["en"])


def identity_fraud_closure_message(language: str, candidate_name: str, identity_check: Dict) -> str:
    announced = (identity_check.get("announced_name") or "").title()
    msgs = {
        "fr": (
            f"J'ai demandé une reconfirmation de votre identité, et vous avez répondu {announced}, "
            f"ce qui ne correspond toujours pas à {candidate_name} pour qui cet entretien a été planifié. "
            f"Pour des raisons d'intégrité du processus de recrutement, je dois mettre fin à cet entretien. "
            f"L'incident est enregistré et transmis au service de recrutement. "
            f"Si vous êtes le véritable {candidate_name}, merci de contacter les ressources humaines pour un nouveau créneau. "
            f"Bonne journée."
        ),
        "en": (
            f"I asked you to reconfirm your identity, and you answered {announced}, "
            f"which still doesn't match {candidate_name} for whom this interview was scheduled. "
            f"For recruitment integrity reasons, I must end this interview. "
            f"The incident has been recorded and forwarded to the recruitment team. "
            f"If you are the real {candidate_name}, please contact HR to reschedule. Goodbye."
        ),
    }
    return msgs.get(language, msgs["en"])


def silence_response_message(language: str, attempt_index: int) -> Tuple[str, bool]:
    """Returns (message, should_end). attempt_index is 1-based consecutive silence count."""
    messages = {
        "fr": [
            "Je suis désolé, je ne vous ai pas entendu. Pouvez-vous répéter votre réponse ?",
            "Je ne vous entends toujours pas. Rencontrez-vous un problème technique ? Prenez votre temps.",
            "Il semble y avoir un problème audio. Vérifiez votre microphone et dites-moi simplement « oui » si vous m'entendez.",
            "Je vais devoir mettre fin à cet entretien en raison de difficultés de communication. Vous pourrez le reprendre ultérieurement. Merci.",
        ],
        "en": [
            "I'm sorry, I didn't hear you. Could you please repeat your answer?",
            "I still can't hear you. Are you experiencing a technical issue? Take your time.",
            "There seems to be an audio problem. Please check your microphone.",
            "I'll have to end this interview due to communication difficulties.",
        ],
    }
    lang_msgs = messages.get(language, messages["fr"])
    idx = min(max(attempt_index, 1) - 1, len(lang_msgs) - 1)
    return lang_msgs[idx], attempt_index >= 4
