"""
Détection d'anomalies par tour d'entretien — seuils stricts, max 1 alerte vocale/tour.
"""
from typing import Dict, List

# Priorité décroissante (une seule mention vocale par tour pour limiter les faux positifs)
_ALERT_PRIORITY = (
    "stt_warning",
    "quality_issue",
    "strong_dissonance",
    "high_stress",
    "short_answer",
    "negative_sentiment",
)


def _t(lang: str, fr: str, en: str) -> str:
    return fr if (lang or "fr").startswith("fr") else en


def _pick_top_alert(alerts: List[Dict[str, str]]) -> List[Dict[str, str]]:
    if not alerts:
        return []
    by_id = {a["id"]: a for a in alerts}
    for aid in _ALERT_PRIORITY:
        if aid in by_id:
            return [by_id[aid]]
    return [alerts[0]]


def build_anomaly_alerts(
    signals: dict,
    transcript: str,
    language: str = "fr",
) -> List[Dict[str, str]]:
    """
    Retourne au plus UNE alerte {id, hint} à mentionner au candidat ce tour.
    Les autres signaux restent dans le JSON technique pour internal_note uniquement.
    """
    alerts: List[Dict[str, str]] = []
    lang = "fr" if (language or "fr").startswith("fr") else "en"
    words = len((transcript or "").split())

    soft = signals.get("soft_signals") or {}
    diss = signals.get("dissonance") or {}
    sentiment = signals.get("verbal_sentiment") or {}
    quality = signals.get("quality_report") or {}

    stress = soft.get("stress_score")
    if stress is not None and float(stress) >= 75:
        alerts.append({
            "id": "high_stress",
            "hint": _t(
                lang,
                "Stress très élevé détecté. Rassure en UNE phrase courte, puis question simple.",
                "Very high stress detected. Reassure in ONE short sentence, then a simple question.",
            ),
        })

    diss_label = diss.get("label")
    diss_score = diss.get("score")
    if diss_label == "strong_dissonance" and diss_score is not None and float(diss_score) >= 55:
        alerts.append({
            "id": "strong_dissonance",
            "hint": _t(
                lang,
                "Incohérence émotionnelle marquée. Une phrase bienveillante max, sans accuser.",
                "Marked emotional inconsistency. One kind sentence max, never accuse.",
            ),
        })

    sent_label = (sentiment.get("label") or "").lower()
    sent_score = float(sentiment.get("score") or 0)
    if ("neg" in sent_label or "negative" in sent_label) and sent_score >= 0.8:
        alerts.append({
            "id": "negative_sentiment",
            "hint": _t(
                lang,
                "Ton très négatif. Empathie brève, puis question neutre.",
                "Very negative tone. Brief empathy, then a neutral question.",
            ),
        })

    stt_warning = signals.get("stt_warning")
    if stt_warning:
        alerts.append({
            "id": "stt_warning",
            "hint": _t(
                lang,
                "Audio/transcription difficile. Demande poliment de répéter.",
                "Hard to hear/transcribe. Politely ask to repeat.",
            ),
        })

    if 3 <= words < 8:
        alerts.append({
            "id": "short_answer",
            "hint": _t(
                lang,
                "Réponse trop courte. Demande un exemple concret.",
                "Answer too short. Ask for a concrete example.",
            ),
        })

    if quality:
        global_score = int(quality.get("global_score") or 100)
        if global_score < 50:
            alerts.append({
                "id": "quality_issue",
                "hint": _t(
                    lang,
                    "Qualité vidéo/audio très faible. UN conseil technique court (caméra ou micro).",
                    "Very poor video/audio. ONE short technical tip (camera or mic).",
                ),
            })

    return _pick_top_alert(alerts)


def format_anomaly_block(alerts: List[Dict[str, str]], language: str = "fr") -> str:
    """Bloc texte injecté dans le system prompt."""
    lang = "fr" if (language or "fr").startswith("fr") else "en"
    if not alerts:
        return _t(lang, "(aucune)", "(none)")

    a = alerts[0]
    return f"[{a['id']}] {a['hint']}"
