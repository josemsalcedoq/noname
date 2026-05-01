# 02 — Utility: Text Translator (EN ↔ ES)

## Goal
Paste arbitrary text into a textarea, pick source/target language, get the translation in the adjacent textarea. Same NMT engine as the DOCX utility — no LLM, no paid APIs.

## Why
- Quick translations without opening Word, Google Translate, or DeepL.
- Acts as the smoke test for the NMT backend used by the DOCX utility.

## Inputs / Outputs
- **Input:** plain text (≤ 50,000 chars), source lang (`en`|`es`|`auto`), target lang (`en`|`es`).
- **Output:** plain text, same structure (line breaks preserved).

## Functional requirements
- F1. Two-pane UI: source textarea (left) and target textarea (right, read-only).
- F2. Language selectors above each pane; a swap button between them.
- F3. Auto-detect source language (`langdetect` or `lingua-py`) when set to "auto".
- F4. Debounced live translation (~500ms after typing stops) OR manual "Translate" button — pick one in spike.
- F5. "Copy to clipboard" button on the target pane.
- F6. Character counter; warn at >50k.

## Non-functional requirements
- NF1. p95 latency < 1s for inputs ≤ 1,000 chars on CPU.
- NF2. Fully offline after model download.
- NF3. No request/response logged to disk.

## BDD scenarios

```gherkin
Feature: Translate text between English and Spanish

  Scenario: Short EN -> ES
    Given I have entered "Hello, how are you?" in the source pane
    And source is "en", target is "es"
    When I trigger translation
    Then the target pane shows the Spanish translation
    And no errors are shown

  Scenario: Multi-paragraph input preserves line breaks
    Given source contains 3 paragraphs separated by blank lines
    When translation runs
    Then the target preserves the same paragraph structure (3 paragraphs, blank lines)

  Scenario: Auto-detect source language
    Given source contains Spanish text
    And source language is set to "auto"
    And target is "en"
    Then the system detects the source as "es"
    And produces an English translation

  Scenario: Swap languages
    Given source is "en" and target is "es"
    When I click the swap button
    Then source becomes "es" and target becomes "en"
    And the previous target text moves to the source pane
    And translation re-runs

  Scenario: Empty input
    Given the source pane is empty
    When I trigger translation
    Then the target pane stays empty
    And no API call is made

  Scenario: Copy to clipboard
    Given the target pane has translated text
    When I click "Copy"
    Then the clipboard contains the target text
    And a confirmation toast is shown

  Scenario: Input over the size limit
    Given I paste 60,000 characters
    When I trigger translation
    Then the UI shows "Input too long, max 50,000 chars"
    And no API call is made
```

## Out of scope (v1)
- Languages other than EN/ES.
- Streaming translation (token-by-token).
- Translation history / saved snippets.
- Glossary / per-domain customization.
- Document upload (handled by DOCX utility).

## Tech notes
- **Engine:** same Argos Translate / OPUS-MT setup as utility 01, shared from `backend/shared/nmt/`.
- **Backend (Django + DRF):** Django app at `backend/utilities/text_translator/`. Endpoint `POST /api/text-translator/translate` → `{ source, target, text }` returns `{ text, detectedSource? }`. Plain `APIView`, no model — stateless.
- **Language detection:** `lingua-py` (more accurate on short text than `langdetect`).
- **Frontend (TanStack):** route at `src/routes/text-translator/`. Use `useMutation` for the translate call; debounce the input with a small hook (or stick to a manual button — see F4). Show the detected source language as a hint when "auto" is selected.

## Risks / open questions
- Live debounced translation can hammer the model on slow machines — start with manual button, upgrade to debounce if it feels good.
- Auto-detect on very short inputs (<10 chars) is unreliable — fall back to "default to EN if unsure" and surface the detected language to the user.
