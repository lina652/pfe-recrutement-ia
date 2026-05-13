"""Single place for email normalization (avoid duplicate users differing only by case)."""


def normalize_email(value: str) -> str:
    if not value:
        return ""
    return value.strip().lower()
