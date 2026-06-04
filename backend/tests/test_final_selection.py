from services.final_selection_service import compute_composite_score, CV_WEIGHT, INTERVIEW_WEIGHT


def test_composite_score_formula():
    # 35% CV + 65% interview on 0–100 scale
    assert CV_WEIGHT == 0.35
    assert INTERVIEW_WEIGHT == 0.65
    assert compute_composite_score(0.8, 60.0) == 67.0


def test_composite_score_clamped_to_100():
    assert compute_composite_score(1.0, 100.0) == 100.0
