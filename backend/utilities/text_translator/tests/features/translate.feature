Feature: Translate text between English and Spanish

  Scenario: Short EN to ES
    Given the source language is "en" and the target language is "es"
    And the input text is "Hello, how are you?"
    When the client posts to the translate endpoint
    Then the response status is 200
    And the response text equals "[en->es] Hello, how are you?"

  Scenario: Auto-detect Spanish source
    Given the source language is "auto" and the target language is "en"
    And the input text is "hola mundo"
    And the language detector reports "es"
    When the client posts to the translate endpoint
    Then the response status is 200
    And the response text equals "[es->en] hola mundo"
    And the response detected_source equals "es"

  Scenario: Auto-detect fails
    Given the source language is "auto" and the target language is "en"
    And the input text is "??"
    And the language detector reports nothing
    When the client posts to the translate endpoint
    Then the response status is 400

  Scenario: Empty input
    Given the source language is "en" and the target language is "es"
    And the input text is ""
    When the client posts to the translate endpoint
    Then the response status is 200
    And the response text equals ""

  Scenario: Same source and target
    Given the source language is "en" and the target language is "en"
    And the input text is "passthrough"
    When the client posts to the translate endpoint
    Then the response status is 200
    And the response text equals "passthrough"

  Scenario: Input over the size limit
    Given the source language is "en" and the target language is "es"
    And the input text exceeds 50000 characters
    When the client posts to the translate endpoint
    Then the response status is 400
