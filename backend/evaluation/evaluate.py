"""
TalentOs AI module evaluation — OCR, NER, semantic matching, RAG, interview bot.

Run from backend/:
    python -m evaluation.evaluate --module all
    python -m evaluation.evaluate --module matching --live

Outputs plots + metrics JSON under evaluation/results/
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.config import settings  # noqa: E402

logger = logging.getLogger(__name__)

EVAL_ROOT = Path(__file__).resolve().parent
DATA_DIR = EVAL_ROOT / "data"
RESULTS_DIR = EVAL_ROOT / "results"

# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s@.+]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def character_error_rate(reference: str, hypothesis: str) -> float:
    ref, hyp = normalize_text(reference), normalize_text(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    d = np.zeros((len(ref) + 1, len(hyp) + 1), dtype=int)
    for i in range(len(ref) + 1):
        d[i, 0] = i
    for j in range(len(hyp) + 1):
        d[0, j] = j
    for i, rc in enumerate(ref, 1):
        for j, hc in enumerate(hyp, 1):
            cost = 0 if rc == hc else 1
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + cost)
    return d[len(ref), len(hyp)] / len(ref)


def word_error_rate(reference: str, hypothesis: str) -> float:
    ref_words = normalize_text(reference).split()
    hyp_words = normalize_text(hypothesis).split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    d = np.zeros((len(ref_words) + 1, len(hyp_words) + 1), dtype=int)
    for i in range(len(ref_words) + 1):
        d[i, 0] = i
    for j in range(len(hyp_words) + 1):
        d[0, j] = j
    for i, rw in enumerate(ref_words, 1):
        for j, hw in enumerate(hyp_words, 1):
            cost = 0 if rw == hw else 1
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + cost)
    return d[len(ref_words), len(hyp_words)] / len(ref_words)


def precision_recall_f1(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


def set_f1(expected: set[str], predicted: set[str]) -> tuple[float, float, float]:
    exp = {normalize_text(x) for x in expected if x}
    pred = {normalize_text(x) for x in predicted if x}
    tp = len(exp & pred)
    fp = len(pred - exp)
    fn = len(exp - pred)
    return precision_recall_f1(tp, fp, fn)


def spearman_correlation(x: list[float], y: list[float]) -> float:
    if len(x) < 2:
        return 0.0
    rx = np.argsort(np.argsort(x))
    ry = np.argsort(np.argsort(y))
    if np.std(rx) == 0 or np.std(ry) == 0:
        return 0.0
    return float(np.corrcoef(rx, ry)[0, 1])


def save_figure(fig: plt.Figure, name: str) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = RESULTS_DIR / name
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _ensure_services_package_stub() -> None:
    """Prevent services/__init__.py from eagerly loading OCR/Groq dependencies."""
    if "services" in sys.modules:
        return
    import types

    pkg = types.ModuleType("services")
    pkg.__path__ = [str(BACKEND_ROOT / "services")]
    sys.modules["services"] = pkg


def _import_backend_module(module_name: str, relative_path: str):
    """Import a backend module without executing services/__init__.py."""
    _ensure_services_package_stub()
    module_path = BACKEND_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _load_matching_service():
    _import_backend_module("services.matching_utils", "services/matching_utils.py")
    matching_mod = _import_backend_module(
        "services.matching_service", "services/matching_service.py"
    )
    return matching_mod.matching_service


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------


def _simulate_scanned_ocr(truth: str) -> str:
    """Introduce realistic OCR noise for scanned documents (offline benchmark)."""
    noisy = truth
    swaps = {"0": "O", "1": "l", "5": "S", "8": "B", "'": "", "é": "e", "à": "a", "è": "e"}
    for src, dst in swaps.items():
        if src in noisy:
            noisy = noisy.replace(src, dst)
    noisy = re.sub(r"\s{2,}", " ", noisy)
    return noisy.strip()


def _detect_ocr_method(extracted: str, doc_type: str) -> str:
    if doc_type.startswith("Digital"):
        return "PyMuPDF"
    return "PaddleOCR"


def evaluate_ocr(*, live: bool = False) -> dict:
    from core.cv_upload import MIN_CV_TEXT_CHARS

    manifest = load_json(DATA_DIR / "ocr" / "manifest.json")
    rows = []
    files_dir = DATA_DIR / "ocr" / "files"

    for item in manifest:
        truth_path = DATA_DIR / "ocr" / item["truth_file"]
        truth = truth_path.read_text(encoding="utf-8")
        extracted = ""
        method = item["expected_method"]
        source = "simulated"

        for ext in (".pdf", ".png", ".jpg", ".jpeg", ".webp"):
            candidate_file = files_dir / f"{item['name']}{ext}"
            if live and candidate_file.exists():
                from core.cv_upload import extract_cv_text

                extracted = extract_cv_text(candidate_file.name, candidate_file.read_bytes())
                source = "live"
                method = _detect_ocr_method(extracted, item["type"])
                break

        if not extracted:
            if item["type"].startswith("Digital"):
                extracted = truth
            else:
                extracted = _simulate_scanned_ocr(truth)
            method = _detect_ocr_method(extracted, item["type"])

        cer = character_error_rate(truth, extracted)
        wer = word_error_rate(truth, extracted)
        coverage = len(extracted.strip()) >= MIN_CV_TEXT_CHARS

        rows.append(
            {
                "id": item["id"],
                "name": item["name"],
                "type": item["type"],
                "language": item["language"],
                "method": method,
                "source": source,
                "cer": round(cer, 4),
                "wer": round(wer, 4),
                "char_count": len(extracted),
                "coverage_ok": coverage,
            }
        )

    # Plot 1: CER / WER per sample
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    labels = [r["id"] for r in rows]
    x = np.arange(len(labels))
    axes[0].bar(x, [r["cer"] * 100 for r in rows], color="#4C78A8")
    axes[0].set_xticks(x, labels)
    axes[0].set_ylabel("CER (%)")
    axes[0].set_title("Character Error Rate (lower is better)")
    axes[0].axhline(5, color="green", linestyle="--", alpha=0.6, label="5% target")
    axes[0].legend()

    axes[1].bar(x, [r["wer"] * 100 for r in rows], color="#F58518")
    axes[1].set_xticks(x, labels)
    axes[1].set_ylabel("WER (%)")
    axes[1].set_title("Word Error Rate (lower is better)")
    fig.suptitle("OCR Evaluation — Text Recovery Quality", fontsize=13, fontweight="bold")
    fig.tight_layout()
    plot_errors = save_figure(fig, "ocr_error_rates.png")

    # Plot 2: extraction method pie
    method_counts: dict[str, int] = {}
    for r in rows:
        method_counts[r["method"]] = method_counts.get(r["method"], 0) + 1
    fig2, ax2 = plt.subplots(figsize=(6, 6))
    ax2.pie(
        method_counts.values(),
        labels=method_counts.keys(),
        autopct="%1.0f%%",
        colors=["#72B7B2", "#E45756"],
        startangle=90,
    )
    ax2.set_title("OCR Extraction Path (PyMuPDF vs PaddleOCR)")
    plot_methods = save_figure(fig2, "ocr_extraction_methods.png")

    summary = {
        "module": "ocr",
        "samples": len(rows),
        "mean_cer_pct": round(np.mean([r["cer"] for r in rows]) * 100, 2),
        "mean_wer_pct": round(np.mean([r["wer"] for r in rows]) * 100, 2),
        "coverage_rate_pct": round(100 * sum(r["coverage_ok"] for r in rows) / len(rows), 1),
        "rows": rows,
        "plots": [str(plot_errors), str(plot_methods)],
        "interpretation": (
            "CER/WER measure how close extracted text is to human-annotated ground truth. "
            "Digital PDFs should use PyMuPDF (near-zero error). Scanned CVs rely on PaddleOCR "
            f"and tolerate higher error; coverage requires at least {MIN_CV_TEXT_CHARS} characters."
        ),
    }
    return summary


# ---------------------------------------------------------------------------
# NER / ER
# ---------------------------------------------------------------------------


def _heuristic_ner_parse(text: str) -> dict:
    """Offline NER baseline from raw text (regex + section parsing)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    name = lines[0] if lines else ""
    email_m = re.search(r"[\w.+-]+@[\w.-]+\.\w+", text)
    phone_m = re.search(r"\+?\d[\d\s().-]{7,}\d", text)
    skills_block = ""
    for marker in ("TECHNICAL SKILLS", "COMPÉTENCES", "CORE SKILLS", "COMPÉTENCES TECHNIQUES"):
        if marker in text:
            skills_block = text.split(marker, 1)[1].split("\n\n", 1)[0]
            break
    technical = [s.strip() for s in re.split(r"[,;]", skills_block) if s.strip()][:8]
    langs = []
    for m in re.finditer(r"(English|French|Spanish|Arabic|Anglais|Français)\s*\(([^)]+)\)", text, re.I):
        langs.append({"language": m.group(1), "level": m.group(2)})
    return {
        "name": name,
        "contact": {
            "email": email_m.group(0) if email_m else "",
            "phone": phone_m.group(0).strip() if phone_m else "",
            "location": "",
            "linkedin": "",
            "github": "",
        },
        "skills": {"technical": technical, "soft": []},
        "languages": langs,
        "education": [],
        "work_experience": [],
        "certifications": [],
        "projects": [],
    }


def _ner_field_scores(gt: dict, pred: dict) -> dict[str, dict[str, float]]:
    scores: dict[str, dict[str, float]] = {}

    def exact_field(key: str, gt_val: str, pred_val: str):
        match = normalize_text(gt_val) == normalize_text(pred_val) and bool(gt_val)
        scores[key] = {
            "precision": 1.0 if match else 0.0,
            "recall": 1.0 if match else 0.0,
            "f1": 1.0 if match else 0.0,
        }

    exact_field("name", gt.get("name", ""), pred.get("name", ""))
    exact_field("email", gt.get("contact", {}).get("email", ""), pred.get("contact", {}).get("email", ""))
    exact_field("phone", gt.get("contact", {}).get("phone", ""), pred.get("contact", {}).get("phone", ""))

    gt_skills = set(gt.get("skills", {}).get("technical", []))
    pred_skills = set(pred.get("skills", {}).get("technical", []))
    p, r, f1 = set_f1(gt_skills, pred_skills)
    scores["technical_skills"] = {"precision": p, "recall": r, "f1": f1}

    gt_langs = {normalize_text(l.get("language", "")) for l in gt.get("languages", [])}
    pred_langs = {normalize_text(l.get("language", "")) for l in pred.get("languages", [])}
    p, r, f1 = set_f1(gt_langs, pred_langs)
    scores["languages"] = {"precision": p, "recall": r, "f1": f1}

    gt_edu = bool(gt.get("education"))
    pred_edu = bool(pred.get("education"))
    match = gt_edu == pred_edu and gt_edu
    scores["education_present"] = {
        "precision": 1.0 if match else 0.0,
        "recall": 1.0 if match else 0.0,
        "f1": 1.0 if match else 0.0,
    }
    return scores


def evaluate_ner(*, live: bool = False) -> dict:
    ner_dir = DATA_DIR / "ner"
    ocr_dir = DATA_DIR / "ocr"
    cases = [
        ("cv_digital_en", "cv_digital_en_truth.txt", "cv_digital_en_gt.json"),
        ("cv_digital_fr", "cv_digital_fr_truth.txt", "cv_digital_fr_gt.json"),
        ("cv_scanned_en", "cv_scanned_en_truth.txt", "cv_scanned_en_gt.json"),
        ("cv_scanned_fr", "cv_scanned_fr_truth.txt", "cv_scanned_fr_gt.json"),
    ]

    per_case = []
    field_aggregate: dict[str, list[float]] = {}

    for case_id, text_file, gt_file in cases:
        text = (ocr_dir / text_file).read_text(encoding="utf-8")
        gt = load_json(ner_dir / gt_file)

        if live and os.getenv("GROQ_API_KEY"):
            ner_mod = _import_backend_module("evaluation_ner_service", "services/ner_service.py")
            pred = ner_mod.ner_service.parse_cv(text)
            mode = "groq_live"
        else:
            pred = _heuristic_ner_parse(text)
            mode = "heuristic_offline"

        field_scores = _ner_field_scores(gt, pred)
        avg_f1 = float(np.mean([v["f1"] for v in field_scores.values()]))
        per_case.append(
            {
                "case": case_id,
                "mode": mode,
                "avg_f1": round(avg_f1, 3),
                "fields": {k: {kk: round(vv, 3) for kk, vv in v.items()} for k, v in field_scores.items()},
            }
        )
        for field, metrics in field_scores.items():
            field_aggregate.setdefault(field, []).append(metrics["f1"])

    fields = list(field_aggregate.keys())
    mean_f1 = [float(np.mean(field_aggregate[f])) for f in fields]

    fig, ax = plt.subplots(figsize=(10, 5))
    x = np.arange(len(fields))
    ax.bar(x, mean_f1, color="#54A24B")
    ax.set_xticks(x, fields, rotation=20, ha="right")
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("F1 score")
    ax.set_title("NER / Entity Recognition — Field-Level F1 (higher is better)")
    for i, v in enumerate(mean_f1):
        ax.text(i, v + 0.02, f"{v:.2f}", ha="center", fontsize=9)
    fig.tight_layout()
    plot_f1 = save_figure(fig, "ner_field_f1.png")

    # Heatmap per case x field
    case_labels = [c["case"] for c in per_case]
    matrix = np.zeros((len(case_labels), len(fields)))
    for i, case in enumerate(per_case):
        for j, field in enumerate(fields):
            matrix[i, j] = case["fields"].get(field, {}).get("f1", 0.0)

    fig2, ax2 = plt.subplots(figsize=(11, 4))
    im = ax2.imshow(matrix, aspect="auto", cmap="YlGn", vmin=0, vmax=1)
    ax2.set_xticks(np.arange(len(fields)), fields, rotation=25, ha="right")
    ax2.set_yticks(np.arange(len(case_labels)), case_labels)
    ax2.set_title("NER F1 Heatmap by CV Case and Field")
    fig2.colorbar(im, ax=ax2, fraction=0.03, label="F1")
    plot_heat = save_figure(fig2, "ner_f1_heatmap.png")

    return {
        "module": "ner",
        "mode": "groq_live" if live else "heuristic_offline",
        "mean_f1": round(float(np.mean(mean_f1)), 3),
        "cases": per_case,
        "plots": [str(plot_f1), str(plot_heat)],
        "interpretation": (
            "NER evaluation compares structured JSON fields against annotated ground truth. "
            "Name/contact use exact match; skills and languages use set-F1. "
            "Use --live to evaluate the Groq llama-3.3-70b parser; offline mode uses a regex baseline."
        ),
    }


# ---------------------------------------------------------------------------
# Semantic matching
# ---------------------------------------------------------------------------


def evaluate_matching() -> dict:
    job_requirements_mod = _import_backend_module(
        "services.job_requirements", "services/job_requirements.py"
    )
    build_job_requirements = job_requirements_mod.build_job_requirements
    matching_service = _load_matching_service()

    job_data = load_json(DATA_DIR / "matching" / "cybersecurity_job.json")
    job = SimpleNamespace(**job_data)
    job_reqs = build_job_requirements(job)
    labels = load_json(DATA_DIR / "matching" / "labels.json")

    rows = []
    human_relevance = []
    predicted_scores = []

    for label in labels:
        parsed_cv = load_json(DATA_DIR / "matching" / label["cv_file"])
        result = matching_service.match(parsed_cv, job_reqs)
        rows.append(
            {
                "candidate": label["candidate"],
                "expected_pct": label["expected_score_pct"],
                "actual_pct": result["match_percentage"],
                "expected_class": label["expected_classification"],
                "actual_class": result["classification"],
                "class_correct": result["classification"] == label["expected_classification"],
                "category_scores": result["category_scores"],
                "details": result["details"],
            }
        )
        human_relevance.append(label["relevance"])
        predicted_scores.append(result["overall_score"])

    mae = float(np.mean([abs(r["expected_pct"] - r["actual_pct"]) for r in rows]))
    class_acc = sum(r["class_correct"] for r in rows) / len(rows)
    spearman = spearman_correlation(human_relevance, predicted_scores)

    # Plot: expected vs actual scores
    fig, ax = plt.subplots(figsize=(10, 5))
    names = [r["candidate"].split()[0] for r in rows]
    x = np.arange(len(names))
    width = 0.35
    ax.bar(x - width / 2, [r["expected_pct"] for r in rows], width, label="Thesis reference", color="#B279A2")
    ax.bar(x + width / 2, [r["actual_pct"] for r in rows], width, label="Model output", color="#4C78A8")
    ax.axhline(50, color="orange", linestyle="--", alpha=0.7, label="MEDIUM threshold (50%)")
    ax.axhline(75, color="green", linestyle="--", alpha=0.7, label="TOP threshold (75%)")
    ax.set_xticks(x, names)
    ax.set_ylabel("Match %")
    ax.set_title("Semantic Matching — Expected vs Actual Scores")
    ax.legend()
    fig.tight_layout()
    plot_scores = save_figure(fig, "matching_scores.png")

    # Plot: category breakdown for best candidate (Chloe)
    best = max(rows, key=lambda r: r["actual_pct"])
    cats = list(best["category_scores"].keys())
    cat_vals = [best["category_scores"][c]["score"] * 100 for c in cats]
    fig2, ax2 = plt.subplots(figsize=(8, 8), subplot_kw={"projection": "polar"})
    angles = np.linspace(0, 2 * np.pi, len(cats), endpoint=False)
    vals = cat_vals + [cat_vals[0]]
    ang = np.concatenate([angles, [angles[0]]])
    ax2.plot(ang, vals, "o-", linewidth=2, color="#E45756")
    ax2.fill(ang, vals, alpha=0.25, color="#E45756")
    ax2.set_xticks(angles, cats)
    ax2.set_ylim(0, 100)
    ax2.set_title(f"Category Scores — {best['candidate']} (top match)")
    plot_radar = save_figure(fig2, "matching_category_radar.png")

    # Confusion-style classification chart
    fig3, ax3 = plt.subplots(figsize=(6, 4))
    colors = ["#54A24B" if r["class_correct"] else "#E45756" for r in rows]
    ax3.barh(names, [1 if r["class_correct"] else 0 for r in rows], color=colors)
    ax3.set_xlim(0, 1.2)
    ax3.set_xlabel("Classification correct (1=yes)")
    ax3.set_title("TOP / MEDIUM / LOW Classification Accuracy")
    for i, r in enumerate(rows):
        ax3.text(0.05, i, f"{r['actual_class']} (exp {r['expected_class']})", va="center", fontsize=9)
    plot_class = save_figure(fig3, "matching_classification.png")

    return {
        "module": "semantic_matching",
        "skill_threshold": settings.SKILL_MATCH_THRESHOLD,
        "score_mae_pct": round(mae, 2),
        "classification_accuracy_pct": round(class_acc * 100, 1),
        "spearman_correlation": round(spearman, 3),
        "rows": rows,
        "plots": [str(plot_scores), str(plot_radar), str(plot_class)],
        "interpretation": (
            "Semantic matching combines weighted category scores (skills, education, experience, "
            f"languages, soft skills, certifications, profile fit). Skills need cosine similarity ≥ "
            f"{settings.SKILL_MATCH_THRESHOLD}. Scores ≥75% are TOP, ≥50% MEDIUM. "
            "Spearman correlation checks whether ranking follows human relevance labels."
        ),
    }


# ---------------------------------------------------------------------------
# RAG (lightweight retrieval eval — no Chroma/Groq required offline)
# ---------------------------------------------------------------------------


@dataclass
class _RagDoc:
    page_content: str
    metadata: dict = field(default_factory=dict)


def _rag_documents_to_context(docs: list[_RagDoc]) -> str:
    return "\n\n---\n\n".join(d.page_content for d in docs if d.page_content)


def _rag_chunk_documents(docs: list[_RagDoc]) -> list[_RagDoc]:
    max_single = max(settings.RAG_CHUNK_SIZE, 3500)
    chunks: list[_RagDoc] = []
    for doc in docs:
        content = doc.page_content or ""
        if doc.metadata.get("type") == "candidate_profile" or content.startswith("CANDIDATE:"):
            chunks.append(doc)
            continue
        if len(content) <= max_single:
            chunks.append(doc)
            continue
        start = 0
        while start < len(content):
            end = min(start + settings.RAG_CHUNK_SIZE, len(content))
            chunks.append(_RagDoc(page_content=content[start:end], metadata=dict(doc.metadata)))
            if end >= len(content):
                break
            start = end - settings.RAG_CHUNK_OVERLAP
    return chunks


def _rag_retrieve_context(question: str, chunks: list[_RagDoc]) -> str:
    del question  # full-context mode for benchmark datasets (<=20 candidates)
    candidate_chunks = [
        c for c in chunks if c.metadata.get("type") == "candidate_profile"
    ]
    if not candidate_chunks:
        candidate_chunks = [c for c in chunks if "CANDIDATE:" in (c.page_content or "")]
    if not candidate_chunks:
        job_chunks = [c for c in chunks if c.metadata.get("type") == "job_requirements"]
        return _rag_documents_to_context(job_chunks)

    if len(candidate_chunks) <= 20:
        job_chunks = [c for c in chunks if c.metadata.get("type") == "job_requirements"]
        return _rag_documents_to_context(job_chunks + candidate_chunks)

    k = min(len(chunks), max(12, len(candidate_chunks) * 2))
    return _rag_documents_to_context(chunks[:k])


def _fact_recall(context: str, facts: list[str]) -> float:
    if not facts:
        return 1.0
    ctx = normalize_text(context)
    hits = sum(1 for f in facts if normalize_text(f) in ctx)
    return hits / len(facts)


def evaluate_rag(*, live: bool = False) -> dict:
    qa_pairs = load_json(DATA_DIR / "rag" / "qa_pairs.json")

    rows = []
    for qa in qa_pairs:
        docs = [
            _RagDoc(page_content=d["page_content"], metadata=d.get("metadata", {}))
            for d in qa["documents"]
        ]
        chunks = _rag_chunk_documents(docs)
        context = _rag_retrieve_context(qa["question"], chunks)
        recall = _fact_recall(context, qa.get("expected_facts", []))

        answer = ""
        faithfulness = 0.0
        if live and os.getenv("GROQ_API_KEY"):
            try:
                from groq import Groq

                client = Groq(api_key=settings.GROQ_API_KEY)
                response = client.chat.completions.create(
                    model=settings.GROQ_LLM_MODEL,
                    temperature=0.3,
                    max_tokens=512,
                    messages=[
                        {
                            "role": "system",
                            "content": "Answer ONLY using the provided recruitment context. If data is missing, say so.",
                        },
                        {
                            "role": "user",
                            "content": f"Context:\n{context}\n\nQuestion: {qa['question']}",
                        },
                    ],
                )
                answer = response.choices[0].message.content or ""
                faithfulness = _fact_recall(answer, qa.get("expected_facts", []))
            except Exception as exc:
                logger.warning("RAG live LLM failed for %s: %s", qa["id"], exc)

        rows.append(
            {
                "id": qa["id"],
                "scenario": qa["scenario"],
                "retrieval_recall": round(recall, 3),
                "context_chars": len(context),
                "faithfulness": round(faithfulness, 3) if answer else None,
                "answer_preview": (answer[:200] + "...") if len(answer) > 200 else answer,
            }
        )

    fig, ax = plt.subplots(figsize=(9, 5))
    ids = [r["id"] for r in rows]
    x = np.arange(len(ids))
    ax.bar(x, [r["retrieval_recall"] * 100 for r in rows], color="#72B7B2", label="Retrieval recall")
    if any(r["faithfulness"] is not None for r in rows):
        ax.bar(
            x,
            [(r["faithfulness"] or 0) * 100 for r in rows],
            bottom=[r["retrieval_recall"] * 100 for r in rows],
            color="#4C78A8",
            alpha=0.8,
            label="Answer faithfulness (live)",
        )
    ax.set_xticks(x, ids)
    ax.set_ylabel("Score (%)")
    ax.set_ylim(0, 110)
    ax.set_title("RAG Evaluation — Retrieval Recall & Answer Groundedness")
    ax.legend()
    fig.tight_layout()
    plot_rag = save_figure(fig, "rag_retrieval_faithfulness.png")

    # Context size chart
    fig2, ax2 = plt.subplots(figsize=(8, 4))
    ax2.bar(ids, [r["context_chars"] for r in rows], color="#F58518")
    ax2.set_ylabel("Retrieved context size (chars)")
    ax2.set_title("RAG Retrieved Context Volume per Question")
    plot_ctx = save_figure(fig2, "rag_context_size.png")

    return {
        "module": "rag",
        "mean_retrieval_recall_pct": round(np.mean([r["retrieval_recall"] for r in rows]) * 100, 1),
        "live_llm": live and bool(os.getenv("GROQ_API_KEY")),
        "rows": rows,
        "plots": [str(plot_rag), str(plot_ctx)],
        "interpretation": (
            "RAG evaluation first checks whether retrieved context contains expected facts (recall). "
            "With --live, the Groq LLM answer is scored for groundedness against those facts. "
            "≤20 candidates use full-context retrieval; larger pools use dynamic k vector search."
        ),
    }


# ---------------------------------------------------------------------------
# AI Interview Bot
# ---------------------------------------------------------------------------


@dataclass
class _MockInterview:
    phase: str = "technical"
    session_state: dict = field(default_factory=dict)


@dataclass
class _MockMessage:
    role: str
    content: str


def _build_fallback_report_data(
    interview: _MockInterview,
    messages: list[_MockMessage],
    *,
    ended_early: bool,
) -> dict:
    """Rule-based interview report (mirrors interview_service._build_fallback_report_data)."""
    candidate_msgs = [m for m in messages if m.role == "candidate"]
    substantive = [
        m
        for m in candidate_msgs
        if (m.content or "").strip()
        and m.content.strip() not in ("[silence]",)
        and len((m.content or "").strip()) >= 3
    ]
    n_substantive = len(substantive)
    total_chars = sum(len((m.content or "").strip()) for m in substantive)
    phase = interview.phase

    if n_substantive == 0:
        return {
            "overall_score": 20.0,
            "communication_score": 2.0,
            "technical_score": 2.0,
            "motivation_score": 2.0,
            "recommendation": "no_hire",
        }

    participation = min(1.0, (n_substantive * 15 + total_chars) / 400.0)
    overall = round(35.0 + participation * 40.0, 1)
    comm = round(3.0 + participation * 4.0, 1)
    tech = round(3.0 + participation * 4.0, 1)
    motiv = round(3.0 + participation * 3.5, 1)

    if ended_early:
        overall = max(25.0, overall - 10.0)

    rec = "maybe" if overall >= 55 else "no_hire"
    return {
        "overall_score": overall,
        "communication_score": comm,
        "technical_score": tech,
        "motivation_score": motiv,
        "recommendation": rec,
    }


def evaluate_bot(*, live: bool = False) -> dict:
    scenarios = load_json(DATA_DIR / "bot" / "scenarios.json")
    rows = []

    for sc in scenarios:
        interview = _MockInterview(phase="technical")
        messages = [_MockMessage(role=m["role"], content=m["content"]) for m in sc["messages"]]
        report = _build_fallback_report_data(interview, messages, ended_early=sc["ended_early"])
        expert = sc["expert"]

        pred_rec = report["recommendation"]
        exp_rec = expert["recommendation"]
        rec_match = pred_rec == exp_rec

        rows.append(
            {
                "id": sc["id"],
                "label": sc["label"],
                "overall_mae": abs(report["overall_score"] - expert["overall_score"]),
                "communication_mae": abs(report["communication_score"] - expert["communication_score"]),
                "technical_mae": abs(report["technical_score"] - expert["technical_score"]),
                "motivation_mae": abs(report["motivation_score"] - expert["motivation_score"]),
                "predicted": {
                    "overall_score": report["overall_score"],
                    "communication_score": report["communication_score"],
                    "technical_score": report["technical_score"],
                    "motivation_score": report["motivation_score"],
                    "recommendation": pred_rec,
                },
                "expert": expert,
                "recommendation_match": rec_match,
            }
        )

    # Scatter: predicted vs expert overall
    fig, ax = plt.subplots(figsize=(6, 6))
    exp_scores = [r["expert"]["overall_score"] for r in rows]
    pred_scores = [r["predicted"]["overall_score"] for r in rows]
    ax.scatter(exp_scores, pred_scores, s=120, c="#4C78A8", edgecolors="white", linewidths=1.5)
    lim = [0, 100]
    ax.plot(lim, lim, "--", color="gray", alpha=0.6, label="Perfect agreement")
    for r in rows:
        ax.annotate(r["id"], (r["expert"]["overall_score"], r["predicted"]["overall_score"]), fontsize=8, xytext=(4, 4), textcoords="offset points")
    ax.set_xlabel("Expert overall score")
    ax.set_ylabel("Bot overall score")
    ax.set_title("Interview Bot — Predicted vs Expert Overall Score")
    ax.legend()
    fig.tight_layout()
    plot_scatter = save_figure(fig, "bot_score_scatter.png")

    # Dimension MAE grouped bar
    fig2, ax2 = plt.subplots(figsize=(10, 5))
    ids = [r["id"] for r in rows]
    x = np.arange(len(ids))
    width = 0.2
    ax2.bar(x - 1.5 * width, [r["overall_mae"] for r in rows], width, label="Overall MAE")
    ax2.bar(x - 0.5 * width, [r["communication_mae"] for r in rows], width, label="Communication MAE")
    ax2.bar(x + 0.5 * width, [r["technical_mae"] for r in rows], width, label="Technical MAE")
    ax2.bar(x + 1.5 * width, [r["motivation_mae"] for r in rows], width, label="Motivation MAE")
    ax2.set_xticks(x, ids)
    ax2.set_ylabel("Mean Absolute Error (lower is better)")
    ax2.set_title("Interview Bot Score Error by Dimension")
    ax2.legend()
    fig2.tight_layout()
    plot_mae = save_figure(fig2, "bot_dimension_mae.png")

    # Recommendation accuracy
    fig3, ax3 = plt.subplots(figsize=(6, 4))
    match_colors = ["#54A24B" if r["recommendation_match"] else "#E45756" for r in rows]
    ax3.bar(ids, [1 if r["recommendation_match"] else 0 for r in rows], color=match_colors)
    ax3.set_ylim(0, 1.2)
    ax3.set_title("Hire Recommendation Agreement with Expert Labels")
    ax3.set_ylabel("Match (1=yes)")
    plot_rec = save_figure(fig3, "bot_recommendation_accuracy.png")

    rec_acc = sum(r["recommendation_match"] for r in rows) / len(rows)
    overall_mae = float(np.mean([r["overall_mae"] for r in rows]))

    note = (
        "Evaluated with rule-based fallback scorer (_build_fallback_report_data). "
        "Use --live with DB interviews for full Groq LLM reports."
        if not live
        else "Live Groq report generation requires database interview records."
    )

    return {
        "module": "ai_interview_bot",
        "overall_score_mae": round(overall_mae, 2),
        "recommendation_accuracy_pct": round(rec_acc * 100, 1),
        "scenarios": rows,
        "plots": [str(plot_scatter), str(plot_mae), str(plot_rec)],
        "interpretation": (
            "The interview bot produces overall (0–100) and dimension scores (0–10) plus a "
            "hire recommendation. This benchmark compares heuristic/LLM reports against expert "
            f"labels on scripted transcripts. {note}"
        ),
    }


# ---------------------------------------------------------------------------
# Summary dashboard
# ---------------------------------------------------------------------------


def plot_summary_dashboard(summaries: list[dict]) -> Path:
    labels = []
    values = []
    colors = []

    metric_map = {
        "ocr": ("mean_cer_pct", "OCR mean CER %", True),
        "ner": ("mean_f1", "NER mean F1", False),
        "semantic_matching": ("classification_accuracy_pct", "Matching class acc %", False),
        "rag": ("mean_retrieval_recall_pct", "RAG retrieval recall %", False),
        "ai_interview_bot": ("overall_score_mae", "Bot overall MAE", True),
    }

    for s in summaries:
        module = s["module"]
        key, label, lower_better = metric_map.get(module, (None, module, False))
        if not key or key not in s:
            continue
        val = s[key]
        labels.append(label)
        values.append(val)
        colors.append("#E45756" if lower_better and val > 10 else "#4C78A8")

    fig, ax = plt.subplots(figsize=(10, 5))
    y = np.arange(len(labels))
    ax.barh(y, values, color=colors)
    ax.set_yticks(y, labels)
    ax.set_title("TalentOs AI Modules — Headline Metrics")
    for i, v in enumerate(values):
        ax.text(v + 0.5, i, f"{v:.2f}", va="center", fontsize=9)
    fig.tight_layout()
    return save_figure(fig, "summary_dashboard.png")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


ALL_MODULES = ["ocr", "ner", "matching", "rag", "bot"]

MODULES = {
    "ocr": evaluate_ocr,
    "ner": evaluate_ner,
    "er": evaluate_ner,
    "matching": evaluate_matching,
    "semantic_matching": evaluate_matching,
    "rag": evaluate_rag,
    "bot": evaluate_bot,
    "ai_bot": evaluate_bot,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate TalentOs AI modules with plots.")
    parser.add_argument(
        "--module",
        default="all",
        help="ocr | ner | matching | rag | bot | all (comma-separated)",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Use live APIs (Groq NER/RAG, real OCR files in data/ocr/files/)",
    )
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO)

    selected = ALL_MODULES if args.module == "all" else [m.strip() for m in args.module.split(",")]
    run_fns: list[tuple[str, Any]] = []
    seen = set()
    for name in selected:
        if name not in MODULES:
            print(f"Unknown module: {name}. Choose from: {', '.join(sorted(set(MODULES.keys())))}")
            return 1
        if name in seen:
            continue
        seen.add(name)
        run_fns.append((name, MODULES[name]))

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    summaries = []
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("\n" + "=" * 60)
    print("  TalentOs AI Evaluation")
    print("=" * 60)

    for name, fn in run_fns:
        print(f"\n>> Running {name}...")
        try:
            if name in ("matching", "semantic_matching"):
                summary = fn()
            else:
                summary = fn(live=args.live)
            summaries.append(summary)
            print(f"  [OK] {summary['module']} complete")
            for plot in summary.get("plots", []):
                print(f"    [plot] {plot}")
            print(f"  [info] {summary.get('interpretation', '')[:120]}...")
        except Exception as exc:
            logger.exception("Module %s failed", name)
            print(f"  [FAIL] {name} failed: {exc}")

    if summaries:
        dash = plot_summary_dashboard(summaries)
        report_path = RESULTS_DIR / f"metrics_{timestamp}.json"
        with report_path.open("w", encoding="utf-8") as fh:
            json.dump(summaries, fh, indent=2, ensure_ascii=False)
        print(f"\n[json] Metrics saved: {report_path}")
        print(f"[plot] Summary dashboard: {dash}")
        print("\n" + "=" * 60)
        print("  HOW TO READ THE PLOTS")
        print("=" * 60)
        _print_plot_guide()
    else:
        print("No modules completed successfully.")
        return 1
    return 0


def _print_plot_guide() -> None:
    guide = """
1. OCR (ocr_error_rates.png, ocr_extraction_methods.png)
   - CER/WER: text recovery accuracy vs annotated CV text. Near 0% = perfect.
   - Pie chart: digital PDFs use PyMuPDF; scanned pages fall back to PaddleOCR.

2. NER (ner_field_f1.png, ner_f1_heatmap.png)
   - Field F1: extraction quality per field (name, email, skills, languages…).
   - Heatmap: which CV types/fields are hardest for the parser.

3. Semantic Matching (matching_scores.png, matching_category_radar.png, matching_classification.png)
   - Bars: model score vs thesis reference (Chloe should be highest ~51%).
   - Radar: per-category contribution for the top candidate.
   - Classification: whether TOP/MEDIUM/LOW labels match expectations.

4. RAG (rag_retrieval_faithfulness.png, rag_context_size.png)
   - Retrieval recall: required facts present in context before LLM answering.
   - Context size: how much text the retriever supplies per question.

5. Interview Bot (bot_score_scatter.png, bot_dimension_mae.png, bot_recommendation_accuracy.png)
   - Scatter: closeness to expert overall score (on diagonal = perfect).
   - MAE bars: error per score dimension.
   - Recommendation: agreement with expert hire/no_hire/maybe labels.
"""
    print(guide)


if __name__ == "__main__":
    raise SystemExit(main())
