Feature: Translate a .docx between English and Spanish

  Scenario: Plain paragraphs
    Given a docx with paragraphs ["Hello", "How are you?"]
    When the client uploads it with source "en" and target "es"
    Then the response status is 200
    And the response is a docx with paragraphs ["[en->es] Hello", "[en->es] How are you?"]
    And the response filename ends with "_es.docx"

  Scenario: Empty paragraphs are preserved
    Given a docx with paragraphs ["", "Hello", ""]
    When the client uploads it with source "en" and target "es"
    Then the response status is 200
    And the response is a docx with paragraphs ["", "[en->es] Hello", ""]

  Scenario: Reject non-docx file
    Given an upload that is not a docx file
    When the client uploads it with source "en" and target "es"
    Then the response status is 400
    And the response error code is "unsupported_format"

  Scenario: Reject same source and target
    Given a docx with paragraphs ["anything"]
    When the client uploads it with source "en" and target "en"
    Then the response status is 400
    And the response error code is "same_language"

  Scenario: Missing file
    When the client posts to docx translate with no file
    Then the response status is 400
    And the response error code is "missing_file"
