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
