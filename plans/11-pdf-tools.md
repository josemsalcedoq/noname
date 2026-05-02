# 11 — Utility: PDF tools (merge, split, extract, OCR)

## Goal
Local-only PDF operations behind a tabbed page: merge multiple PDFs into one, split a PDF by page ranges into a zip, extract embedded text, and OCR scanned PDFs that have no text layer.

> **Not** an Acrobat-like full editor (text editing inside pages, drawing, signing, form fields). That scope is multi-month and tracked under "Future phases" below.

## Why
- macOS Preview handles trivial PDF moves, but loops back to the dock for every operation. A focused web tool with merge / split / extract / OCR in one tabbed view is faster.
- OCR specifically: macOS auto-OCRs in Preview but doesn't expose the structured text. We do.
- All of this stays local — same trust model as the rest of the hub.

## Scope by phase

| Phase | Deliverable                                                  | Status |
|-------|--------------------------------------------------------------|--------|
| 1     | Merge, split (page ranges), extract embedded text, OCR        | done   |
| 2     | Page operations: reorder (up/down arrows), rotate, delete     | done   |
| 2.1   | Insert blank page anywhere                                    | done   |
| 3     | In-browser viewer (PDF.js) — view-only with zoom + paging     | done   |
| 3.1   | Sticky-note annotations (click-on-canvas → pikepdf `/Text` annotation) | done   |
| 3.2   | Highlight rectangles, free-text overlays, ink/freehand drawing | future |
| 4     | Searchable PDF output (text layer via `ocrmypdf`)             | done   |
| 5     | AcroForm fill (discover field names + write back values)      | done   |
| 5.1   | XFA forms (Adobe-only — out of scope, document)               | future |
| 6     | Text-content editing, cryptographic signatures                | future |

## Inputs / Outputs

### Merge
- **Input:** ≥ 2 PDF files.
- **Output:** single merged PDF (`merged.pdf`).

### Split
- **Input:** one PDF + ranges spec like `1-3,5,7-10`.
- **Output:** zip with one PDF per range (`<stem>_split.zip`).

### Extract text
- **Input:** one PDF.
- **Output:** JSON `{ pages: [str], text: str, page_count: int }`.

### OCR
- **Input:** one PDF + optional Tesseract languages (default `eng+spa`).
- **Output:** JSON same shape as extract-text, plus `languages` echoed.

## Functional requirements
- F1. Reject any non-`.pdf` upload with `unsupported_format`.
- F2. Reject files larger than 100 MB with `file_too_large` (HTTP 413).
- F3. Merge requires ≥ 2 files (`too_few_files`).
- F4. Split: validate every range token; error code `invalid_ranges` for bad / out-of-bounds input.
- F5. OCR: render each page to image with `pypdfium2`, run `pytesseract.image_to_string`, return per-page text. No re-typeset PDF in v1.
- F6. Default OCR languages: `eng+spa`. User can override via the `languages` field.

## Non-functional requirements
- NF1. Operations run synchronously per request. Long OCR jobs may exceed typical proxy timeouts; document and consider async in Phase 2.
- NF2. No persistent state — uploads are read into memory, the result returned, the upload garbage-collected.
- NF3. System dep: Tesseract binary on the host (`brew install tesseract`). Documented in README.

## BDD scenarios

```gherkin
Feature: PDF tools operations

  Scenario: Merge two single-page PDFs
    Given a single-page PDF "a.pdf" containing "alpha"
    And a single-page PDF "b.pdf" containing "beta"
    When the client uploads both files to merge
    Then the response status is 200
    And the response is a PDF with 2 pages

  Scenario: Reject merge with one file
    Given a single-page PDF "a.pdf" containing "alpha"
    When the client uploads only "a.pdf" to merge
    Then the response status is 400
    And the response error code is "too_few_files"

  Scenario: Split with valid range produces a zip
    Given a 5-page PDF
    When the client splits with ranges "1-2,4"
    Then the response status is 200
    And the response is a zip with 2 entries

  Scenario: Split rejects invalid ranges
    Given a 5-page PDF
    When the client splits with ranges "10-20"
    Then the response status is 400
    And the response error code is "invalid_ranges"

  Scenario: Extract text returns per-page strings
    Given a single-page PDF "doc.pdf" containing "hello world"
    When the client requests text extraction of "doc.pdf"
    Then the response status is 200
    And the response page_count equals 1
    And the response text contains "hello world"
```

## Out of scope (v1, current state)
- Page reorder / rotate / delete / insert (Phase 2).
- Annotations beyond sticky notes: highlight rectangles, underline, free-text, ink/drawing (Phase 3.2+).
- Searchable / "OCR'd" PDF output (Phase 4).
- Text-content editing (Phase 5+).
- Form fill, signatures, redaction.
- Encrypted PDF unlock / re-encrypt.

## Tech notes

### Backend
- New Django app `utilities/pdf_tools/`.
- Endpoints (multipart):
  - `POST /api/pdf-tools/merge` (field `files[]`)
  - `POST /api/pdf-tools/split` (field `file`, `ranges`)
  - `POST /api/pdf-tools/extract-text` (field `file`)
  - `POST /api/pdf-tools/ocr` (field `file`, optional `languages`)
- Libs:
  - `pikepdf` — merge / split, robust against complex / encrypted PDFs.
  - `pdfplumber` — text extraction with reasonable layout retention.
  - `pypdfium2` — page rendering for OCR; lighter than `pdf2image` (no poppler dep).
  - `pytesseract` — Tesseract Python wrapper.
- Range parser: simple regex over comma-separated tokens (`N` or `N-M`). 1-indexed, validated against `len(pdf.pages)`.

### Frontend
- New route `/pdf-tools` with tabs in URL search params (`?tab=merge|split|extract|ocr`).
- Each tab is its own component with a focused dropzone + per-op options.
- Results stream back as Blob (merge / split) or render inline (extract / OCR).
- "Download .txt" on extract / OCR results.

### Frontend chain integration (potential)
- OCR / extract result → "translate this text →" handoff to text-translator, mirroring the audio-transcriber flow. Not wired yet — easy follow-up.

## Risks / open questions
- **Long-running OCR**: a 50-page scanned PDF can take minutes on CPU. Eventually move to async with progress polling (Phase 2).
- **Layout fidelity** in `extract-text` is best-effort; multi-column docs and tables will be messy. Acceptable for v1.
- **Tesseract languages**: user may not have all languages installed; document `tesseract --list-langs`.
- **Memory**: 100 MB cap is enforced server-side, but pikepdf may still hold the full PDF in memory during merge. For everyday use it's fine.
- **No virus scanning** on uploads. Single-user local — acceptable; document if multi-user is ever considered.
