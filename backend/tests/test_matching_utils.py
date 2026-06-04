from services.matching_utils import canonical_language, education_level, languages_equivalent


def test_canonical_language_french():
    assert canonical_language("FR") == "french"
    assert canonical_language("francais") == "french"


def test_languages_equivalent_en_fr_aliases():
    assert languages_equivalent("English", "Anglais")
    assert languages_equivalent("FR", "fr")


def test_education_level_bachelor():
    assert education_level("Bachelor of Science in IT") >= 3
