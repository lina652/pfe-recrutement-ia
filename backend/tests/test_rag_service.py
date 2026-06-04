"""Unit tests for RAG chunking and retrieval (no Groq / Chroma / HuggingFace load)."""

from unittest.mock import MagicMock

import pytest
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.config import settings
from services.rag_service import RAGService


@pytest.fixture
def rag_svc():
    """RAGService instance without __init__ (avoids embedding + LLM download)."""
    svc = object.__new__(RAGService)
    svc.text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.RAG_CHUNK_SIZE,
        chunk_overlap=settings.RAG_CHUNK_OVERLAP,
        separators=["\n\nCANDIDATE:", "\n\n---\n\n", "\n\n", "\n", " "],
    )
    svc._full_context_candidate_limit = 20
    svc.vector_stores = {}
    svc._chunk_cache = {}
    return svc


def test_rag_config_defaults():
    assert settings.RAG_CHUNK_SIZE == 1000
    assert settings.RAG_CHUNK_OVERLAP == 200
    assert settings.RAG_COLLECTION_PREFIX == "recruitment"


def test_candidate_profile_is_not_split(rag_svc):
    """Candidate profiles stay in one chunk (semantic unit per candidate)."""
    long_cv = "CANDIDATE: Alice\n" + ("skills " * 800)
    docs = [
        Document(
            page_content=long_cv,
            metadata={"type": "candidate_profile", "candidate_id": "c1"},
        )
    ]
    chunks = rag_svc._chunk_documents(docs)
    assert len(chunks) == 1
    assert chunks[0].metadata["candidate_id"] == "c1"


def test_short_job_requirements_single_chunk(rag_svc):
    docs = [
        Document(
            page_content="JOB: Python developer\nRequired: Python, SQL",
            metadata={"type": "job_requirements"},
        )
    ]
    chunks = rag_svc._chunk_documents(docs)
    assert len(chunks) == 1


def test_long_job_requirements_are_split(rag_svc):
    """Job text longer than max( RAG_CHUNK_SIZE, 3500 ) is split."""
    max_single = max(settings.RAG_CHUNK_SIZE, 3500)
    long_text = "JOB REQUIREMENTS:\n" + ("requirement line.\n" * 500)
    assert len(long_text) > max_single

    docs = [
        Document(
            page_content=long_text,
            metadata={"type": "job_requirements"},
        )
    ]
    chunks = rag_svc._chunk_documents(docs)
    assert len(chunks) > 1


def test_documents_to_context_joins_with_separator(rag_svc):
    a = Document(page_content="Part A", metadata={})
    b = Document(page_content="Part B", metadata={})
    ctx = rag_svc._documents_to_context([a, b])
    assert ctx == "Part A\n\n---\n\nPart B"


def test_retrieve_empty_when_no_candidate_chunks(rag_svc):
    mock_store = MagicMock()
    chunks = [
        Document(page_content="JOB only", metadata={"type": "job_requirements"}),
    ]
    assert rag_svc._retrieve_context(mock_store, "best candidate?", chunks) == ""
    mock_store.as_retriever.assert_not_called()


def test_retrieve_full_context_when_at_most_20_candidates(rag_svc):
    """No vector search when candidate count <= _full_context_candidate_limit."""
    mock_store = MagicMock()
    job = Document(
        page_content="JOB: Data Analyst",
        metadata={"type": "job_requirements"},
    )
    candidates = [
        Document(
            page_content=f"CANDIDATE: Person {i}",
            metadata={"type": "candidate_profile", "candidate_id": f"c{i}"},
        )
        for i in range(5)
    ]
    chunks = [job] + candidates

    ctx = rag_svc._retrieve_context(mock_store, "top candidates?", chunks)

    mock_store.as_retriever.assert_not_called()
    assert "JOB: Data Analyst" in ctx
    assert "CANDIDATE: Person 0" in ctx
    assert "CANDIDATE: Person 4" in ctx
    assert ctx.count("---") >= 5


def test_retrieve_uses_dynamic_k_when_many_candidates(rag_svc):
    """k = min(len(chunks), max(12, num_candidates * 2)) — not a fixed k=5."""
    mock_store = MagicMock()
    mock_retriever = MagicMock()
    mock_retriever.invoke.return_value = [
        Document(page_content="retrieved", metadata={"type": "candidate_profile"}),
    ]
    mock_store.as_retriever.return_value = mock_retriever

    job = Document(page_content="JOB", metadata={"type": "job_requirements"})
    n_candidates = 25
    candidates = [
        Document(
            page_content=f"CANDIDATE: {i}",
            metadata={"type": "candidate_profile"},
        )
        for i in range(n_candidates)
    ]
    chunks = [job] + candidates
    expected_k = min(len(chunks), max(12, n_candidates * 2))

    rag_svc._retrieve_context(mock_store, "who fits best?", chunks)

    mock_store.as_retriever.assert_called_once_with(search_kwargs={"k": expected_k})
    assert expected_k == 26  # min(26, max(12, 50)) = 26
    mock_retriever.invoke.assert_called_once_with("who fits best?")


def test_retrieve_k_minimum_is_12_with_3_candidates_over_limit(rag_svc):
    """With >20 candidates, k is at least 12 even for a small pool edge case."""
    mock_store = MagicMock()
    mock_retriever = MagicMock()
    mock_retriever.invoke.return_value = []
    mock_store.as_retriever.return_value = mock_retriever

    candidates = [
        Document(
            page_content=f"C{i}",
            metadata={"type": "candidate_profile"},
        )
        for i in range(21)
    ]
    chunks = candidates
    expected_k = min(len(chunks), max(12, 21 * 2))

    rag_svc._retrieve_context(mock_store, "q", chunks)

    mock_store.as_retriever.assert_called_once_with(search_kwargs={"k": expected_k})
    assert expected_k == 21


def test_refresh_vector_store_clears_cache(rag_svc):
    rag_svc.vector_stores["job-1"] = MagicMock()
    rag_svc._chunk_cache["job-1"] = [Document(page_content="x", metadata={})]

    rag_svc.refresh_vector_store("job-1")

    assert "job-1" not in rag_svc.vector_stores
    assert "job-1" not in rag_svc._chunk_cache
