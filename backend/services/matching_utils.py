"""Normalization helpers for cross-language CV ↔ job matching."""

import re

LANGUAGE_ALIASES: dict[str, set[str]] = {
    "english": {"english", "anglais", "en", "engl"},
    "french": {"french", "français", "francais", "fr", "fren"},
    "arabic": {"arabic", "arabe", "ar", "arab"},
    "spanish": {"spanish", "espagnol", "es", "español", "espanol"},
    "german": {"german", "allemand", "de", "deutsch"},
    "italian": {"italian", "italien", "it", "italiano"},
    "portuguese": {"portuguese", "portugais", "pt", "português", "portugues"},
}

EDUCATION_LEVELS: dict[str, int] = {
    "phd": 5,
    "doctorate": 5,
    "doctorat": 5,
    "master": 4,
    "mastère": 4,
    "mastere": 4,
    "mba": 4,
    "ingenieur": 4,
    "ingénieur": 4,
    "engineer": 4,
    "engineering": 4,
    "bachelor": 3,
    "licence": 3,
    "license": 3,
    "bts": 2,
    "dut": 2,
    "associate": 2,
    "bac": 1,
}


def canonical_language(name: str) -> str:
    if not name:
        return ""
    cleaned = re.sub(r"\([^)]*\)", "", str(name).lower().strip())
    cleaned = cleaned.replace("_", " ").strip()
    for canonical, aliases in LANGUAGE_ALIASES.items():
        if cleaned == canonical or cleaned in aliases:
            return canonical
        if any(cleaned == alias or alias in cleaned for alias in aliases):
            return canonical
    return cleaned


def languages_equivalent(required: str, cv_language: str) -> bool:
    req = canonical_language(required)
    cv = canonical_language(cv_language)
    if not req or not cv:
        return False
    if req == cv:
        return True
    return req in cv or cv in req


def education_level(degree_text: str) -> int:
    if not degree_text:
        return 0
    text = str(degree_text).lower().strip()
    compact = re.sub(r"\s+", "", text)

    bac_plus = re.search(r"bac\+(\d+)", compact)
    if bac_plus:
        years = int(bac_plus.group(1))
        if years >= 8:
            return 5
        if years >= 5:
            return 4
        if years >= 3:
            return 3
        if years >= 2:
            return 2
        return 1

    for key, level in EDUCATION_LEVELS.items():
        if key in text:
            return level
    return 0
