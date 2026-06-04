from unittest.mock import MagicMock, patch

from core.config import settings
from services.matching_service import MatchingService


@patch("services.matching_service.util.cos_sim")
def test_skill_below_threshold_is_missing(mock_cos_sim):
    """Scores under SKILL_MATCH_THRESHOLD (0.42) must not count as a match."""
    below = MagicMock()
    below.item.return_value = settings.SKILL_MATCH_THRESHOLD - 0.1
    mock_cos_sim.return_value = below

    service = MatchingService()
    service._model = MagicMock()
    service._model.encode.return_value = [[0.0] * 384, [0.0] * 384]

    score, details = service._match_skills(
        ["Python"],
        {"required": ["Kubernetes"]},
    )

    assert score == 0.0
    assert details["missing"] == ["Kubernetes"]
    assert details["matched"] == []


@patch("services.matching_service.util.cos_sim")
def test_skill_at_or_above_threshold_is_matched(mock_cos_sim):
    above = MagicMock()
    above.item.return_value = settings.SKILL_MATCH_THRESHOLD + 0.1
    mock_cos_sim.return_value = above

    service = MatchingService()
    service._model = MagicMock()
    service._model.encode.return_value = [[0.0] * 384, [0.0] * 384]

    score, details = service._match_skills(
        ["Python"],
        {"required": ["Python"]},
    )

    assert score > 0
    assert len(details["matched"]) == 1
    assert details["missing"] == []
