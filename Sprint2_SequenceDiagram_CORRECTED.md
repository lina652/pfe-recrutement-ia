```mermaid
sequenceDiagram
    actor Candidate
    participant Frontend as Web Frontend
    participant API as FastAPI Backend
    participant OCR as OCR Service
    participant NER as NER Service
    participant DB as Database

    Candidate->>Frontend: Upload CV file
    Frontend->>API: POST /candidate/signup/cv
    API->>OCR: Extract text from CV
    OCR-->>API: Raw CV text

    alt Text length >= 30 characters
        API->>NER: Parse CV into structured JSON
        NER-->>API: Extracted profile data
        API-->>Frontend: Extracted name, email, phone, skills
    else Text length < 30 characters
        API-->Frontend: Validation error
    end

    Candidate->>Frontend: Confirm extracted data and set password
    Frontend->>API: POST /candidate/signup/confirm
    API->>DB: Create user and candidate profile
    API-->>Frontend: Account created successfully
```

## Arrow Legend for Mermaid Sequence Diagrams

- **`->>`** solid line with filled arrowhead: response/return with data payload
- **`-->`** dashed line, no arrowhead: async response or informational message (empty)
- **`->>`** solid line to participant: synchronous call
- **`-->`** dashed line to participant: asynchronous call

**Changes made:**
- `API-->Frontend: Validation error` — Changed to dashed arrow (no data payload, just an error notification)
- `API-->>Frontend: Account created successfully` — Kept solid filled arrow (response contains success confirmation)
