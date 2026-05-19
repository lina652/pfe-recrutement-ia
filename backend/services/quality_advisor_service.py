"""
Diagnostic qualité session (éclairage, visage, audio) + conseils candidat.
"""
import logging
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def analyze_lighting(frame_paths: List[str]) -> Dict:
    if not frame_paths:
        return {"quality": "unknown", "score": 0, "details": {}}

    brightnesses, contrasts, saturations = [], [], []
    uneven_count = 0
    hot_spot_count = 0

    for fp in frame_paths:
        img = cv2.imread(fp)
        if img is None:
            continue
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        mean_b = float(gray.mean())
        contrast = float(gray.std())
        saturation = float(hsv[:, :, 1].mean())
        brightnesses.append(mean_b)
        contrasts.append(contrast)
        saturations.append(saturation)
        h, w = gray.shape
        if abs(gray[:, : w // 2].mean() - gray[:, w // 2 :].mean()) > 40:
            uneven_count += 1
        if (gray > 240).sum() / gray.size > 0.05:
            hot_spot_count += 1

    if not brightnesses:
        return {"quality": "unknown", "score": 0, "details": {}}

    avg_b = float(np.mean(brightnesses))
    avg_c = float(np.mean(contrasts))
    avg_s = float(np.mean(saturations))
    uneven_ratio = uneven_count / len(brightnesses)
    hot_ratio = hot_spot_count / len(brightnesses)

    if avg_b < 60:
        quality, score = "dark", max(0, int(avg_b / 60 * 50))
    elif hot_ratio > 0.3:
        quality, score = "too_bright", 30
    elif avg_b > 200:
        quality, score = "too_bright", max(0, int((255 - avg_b) / 55 * 50))
    elif uneven_ratio > 0.4:
        quality, score = "uneven", 50
    elif avg_c < 25:
        quality, score = "low_contrast", 60
    elif avg_s < 30 and avg_b > 150:
        quality, score = "washed_out", 55
    else:
        quality, score = "good", min(100, 70 + int(avg_c / 2))

    return {
        "quality": quality,
        "score": score,
        "details": {
            "avg_brightness": round(avg_b, 1),
            "avg_contrast": round(avg_c, 1),
            "avg_saturation": round(avg_s, 1),
            "uneven_ratio": round(uneven_ratio, 2),
            "hot_spot_ratio": round(hot_ratio, 2),
        },
    }


def analyze_face_detectability(emotion_result: dict, nb_frames: int) -> Dict:
    n_face = emotion_result.get("frames_with_face", 0)
    rate = n_face / nb_frames if nb_frames > 0 else 0
    if rate == 0:
        quality, score = "no_face", 0
    elif rate < 0.4:
        quality, score = "poor", int(rate * 100)
    elif rate < 0.7:
        quality, score = "partial", int(rate * 100)
    else:
        quality, score = "good", int(rate * 100)
    return {
        "quality": quality,
        "score": score,
        "detection_rate": round(float(rate), 2),
        "frames_with_face": n_face,
        "frames_total": nb_frames,
    }


def analyze_audio_quality(audio_path: str) -> Dict:
    try:
        from pydub import AudioSegment

        seg = AudioSegment.from_file(audio_path)
        samples = np.array(seg.get_array_of_samples(), dtype=np.float64)
        if seg.channels > 1:
            samples = samples.reshape((-1, seg.channels)).mean(axis=1)
        if len(samples) == 0:
            return {"quality": "empty", "score": 0, "details": {}}

        peak = float(np.max(np.abs(samples)) / (2**15))
        rms = float(np.sqrt(np.mean(samples**2)) / (2**15))
        sorted_abs = np.sort(np.abs(samples))
        noise_floor = float(sorted_abs[: max(1, int(len(sorted_abs) * 0.1))].mean()) / (2**15)
        snr_db = 20 * np.log10(rms / (noise_floor + 1e-9)) if noise_floor > 0 else 60.0
        clipping_ratio = float((np.abs(samples) > 0.98 * 2**15).sum() / len(samples))

        if rms < 0.01:
            quality, score = "too_quiet", max(0, int(rms * 5000))
        elif clipping_ratio > 0.01:
            quality, score = "clipping", 40
        elif snr_db < 10:
            quality, score = "noisy", max(0, int(snr_db * 5))
        elif snr_db < 20:
            quality, score = "acceptable", 60 + int(snr_db - 10)
        else:
            quality, score = "good", min(100, 80 + int((snr_db - 20) / 2))

        return {
            "quality": quality,
            "score": score,
            "details": {
                "rms": round(rms, 4),
                "peak": round(peak, 3),
                "snr_db": round(float(snr_db), 1),
                "clipping_ratio": round(clipping_ratio, 4),
            },
        }
    except Exception as exc:
        logger.warning("Audio quality analysis failed: %s", exc)
        return {"quality": "error", "score": 0, "details": {"error": str(exc)}}


def advisor_agent(
    lighting: dict, face_detect: dict, audio: dict, language: str = "fr"
) -> Optional[str]:
    issues = []
    if lighting["quality"] in ("dark", "too_bright", "uneven", "low_contrast", "washed_out"):
        issues.append(lighting["quality"])
    if face_detect["quality"] in ("no_face", "poor", "partial"):
        issues.append(
            "no_face"
            if face_detect["quality"] == "no_face"
            else ("face_poor" if face_detect["quality"] == "poor" else "face_partial")
        )
    if audio["quality"] in ("too_quiet", "noisy", "clipping"):
        issues.append(audio["quality"])

    if not issues:
        return None

    msgs_fr = {
        "dark": "L'éclairage est trop faible. Rapprochez-vous d'une fenêtre ou ajoutez une lampe face à vous.",
        "too_bright": "La lumière est trop forte. Éloignez la source de lumière ou réduisez son intensité.",
        "washed_out": "Votre image est trop claire. Réduisez l'intensité de la lumière.",
        "uneven": "L'éclairage est inégal. Placez la source de lumière face à vous.",
        "low_contrast": "L'image manque de contraste. Un meilleur éclairage frontal aiderait.",
        "no_face": "Je ne vois pas votre visage. Placez-vous face à la caméra à environ 50 cm.",
        "face_poor": "Votre visage n'est pas bien détecté. Améliorez l'éclairage.",
        "face_partial": "Votre visage n'est détecté que par intermittence. Restez face à la caméra.",
        "too_quiet": "Votre voix est trop faible. Rapprochez-vous du microphone.",
        "noisy": "Il y a trop de bruit de fond. Trouvez un endroit plus calme.",
        "clipping": "Votre microphone sature. Éloignez-vous légèrement.",
    }
    msgs_en = {
        "dark": "Lighting is too low. Move closer to a window or add a lamp in front of you.",
        "too_bright": "Light is too strong. Move the light source away.",
        "washed_out": "Your image is too bright. Reduce light intensity.",
        "uneven": "Lighting is uneven. Place the light source in front of you.",
        "low_contrast": "Image lacks contrast. Better frontal lighting would help.",
        "no_face": "I can't see your face. Please face the camera about 50 cm away.",
        "face_poor": "Your face isn't detected well. Improve lighting.",
        "face_partial": "Your face is only detected occasionally.",
        "too_quiet": "Your voice is too quiet. Move closer to the microphone.",
        "noisy": "Too much background noise. Find a quieter spot.",
        "clipping": "Your microphone is saturating. Move back slightly.",
    }
    msg_dict = msgs_fr if language == "fr" else msgs_en
    priority = [
        "no_face",
        "too_quiet",
        "clipping",
        "dark",
        "too_bright",
        "washed_out",
        "uneven",
        "face_poor",
        "face_partial",
        "noisy",
        "low_contrast",
    ]
    conseils = []
    for issue in priority:
        if issue in issues and issue in msg_dict:
            conseils.append(msg_dict[issue])
            if len(conseils) == 2:
                break
    if not conseils:
        return None
    preambules = {
        "fr": "Un petit point technique avant de continuer : ",
        "en": "A quick technical note before we continue: ",
    }
    return preambules.get(language, preambules["en"]) + " ".join(conseils)
