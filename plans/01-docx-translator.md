# 01 — Utility: DOCX Translator (EN ↔ ES)

## Goal
Upload a Microsoft Word document (`.docx`) in English, receive the same document translated into Spanish (or vice versa), with original formatting preserved. No paid APIs, no LLMs.

## Why
- Recurring need: translation jobs / personal docs.
- Off-the-shelf options either cost money (DeepL Pro) or destroy formatting (copy-paste from Google Translate).

## Inputs / Outputs
- **Input:** `.docx` file (≤ 25 MB), source language (`en` or `es`), target language (`en` or `es`).
- **Output:** `.docx` file with the same name suffixed `_<targetLang>` (e.g. `report_es.docx`), formatting preserved as much as the underlying lib allows.

## Functional requirements
- F1. Accept `.docx` upload via the web UI.
- F2. Detect or accept user-specified source language.
- F3. Translate paragraph text, table cells, headers, and footers.
- F4. Preserve runs (bold/italic/underline), paragraph styles, lists, tables, images.
- F5. Stream or download the translated `.docx` back to the user.
- F6. Show a progress indicator (file is processed paragraph by paragraph).
- F7. Display warnings for content that could not be translated (e.g. embedded objects, math).

## Non-functional requirements
- NF1. Fully offline after model download.
- NF2. Translation of a 5,000-word doc completes in ≤ 60s on a developer laptop (CPU, no GPU required).
- NF3. No file persisted server-side after response is sent (delete in `finally`).
- NF4. Memory usage stays bounded — process the document in a streaming fashion where possible.

## BDD scenarios

```gherkin
Feature: Translate a .docx from English to Spanish

  Scenario: Plain paragraphs
    Given a .docx with 3 English paragraphs and no formatting
    When I upload it and select "EN -> ES"
    Then I receive a .docx with 3 Spanish paragraphs
    And the paragraph order is preserved

  Scenario: Bold and italic runs preserved
    Given a .docx where some words are bold and some are italic
    When I translate EN -> ES
    Then the corresponding Spanish words at the same positions are bold/italic
    And no formatting bleeds into adjacent runs

  Scenario: Tables preserved
    Given a .docx containing a 3x3 table with English text in each cell
    When I translate EN -> ES
    Then the output contains a 3x3 table at the same position
    And each cell contains the translation of the original cell

  Scenario: Reverse direction
    Given a .docx in Spanish
    When I select "ES -> EN"
    Then I receive a .docx in English with formatting preserved

  Scenario: Reject non-docx
    Given the user uploads a .pdf
    When the request is sent
    Then the API returns 400 with error "unsupported_format"
    And no file is written to disk

  Scenario: File too large
    Given a .docx larger than 25 MB
    When the user uploads it
    Then the API returns 413 with error "file_too_large"

  Scenario: Empty document
    Given a .docx with no text content
    When I translate it
    Then I receive a valid .docx with no text content
    And no error is shown

  Scenario: Untranslatable embedded content
    Given a .docx with an embedded Excel object
    When I translate it
    Then the output preserves the embedded object unchanged
    And the response includes a warning listing skipped objects
```

## Out of scope (v1)
- `.doc` (legacy binary), `.odt`, `.rtf`, `.pdf`.
- OCR of images inside the document.
- Languages other than EN/ES.
- Translation memory / glossary.
- Side-by-side bilingual output.

## Tech notes
- **Translation engine (free, local):** Argos Translate (wrapper over OPUS-MT) as the default; OPUS-MT direct for finer control. NLLB-200 distilled-600M as a higher-quality fallback if Argos quality is unacceptable. Lives in `backend/shared/nmt/`, shared with utility 02.
- **DOCX manipulation:** `python-docx` for paragraphs/runs/tables/headers/footers; if formatting fidelity is poor, drop down to direct OOXML XML editing (`zipfile` + `lxml`).
- **Backend (Django + DRF):** Django app at `backend/utilities/docx_translator/`. Endpoint `POST /api/docx-translator/translate` accepts `multipart/form-data` (file + source/target lang) and returns a `FileResponse` with the translated `.docx`. Use DRF's `MultiPartParser`.
- **Frontend (TanStack):** route at `src/routes/docx-translator/`. Use a `useMutation` from TanStack Query to upload (with `FormData`); response is a Blob the user downloads.
- **Model storage:** `backend/models/` (gitignored, Docker volume `backend_data:/data/models`). First-launch management command `python manage.py download_nmt_models` pulls Argos `en→es` and `es→en`.

## Risks / open questions
- Argos quality on technical/marketing copy — may need NLLB instead. Decide after a sample test.
- Run-level translation: translating one run at a time mangles sentences; translating one paragraph at a time loses run granularity. Likely answer: translate paragraph as a whole, then re-distribute runs heuristically. Needs a spike.
- Headers/footers and footnotes are easy to miss with `python-docx` — confirm coverage during scenario implementation.
