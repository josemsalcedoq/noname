Feature: Translate an SRT subtitle file

  Scenario: Translate cues
    Given an SRT with cues "Hello there." and "How are you?"
    When the client uploads it with source "en" and target "es"
    Then the response status is 200
    And the response is an SRT with cues "[en->es] Hello there." and "[en->es] How are you?"
    And the response filename ends with "_es.srt"

  Scenario: Reject non-srt file
    Given an upload that is not an srt file
    When the client uploads it with source "en" and target "es"
    Then the response status is 400
    And the response error code is "unsupported_format"

  Scenario: Reject same source and target
    Given an SRT with cues "x"
    When the client uploads it with source "en" and target "en"
    Then the response status is 400
    And the response error code is "same_language"

  Scenario: Reject malformed srt
    Given an upload "bad.srt" with content "not actually srt content"
    When the client uploads it with source "en" and target "es"
    Then the response status is 400
    And the response error code is "invalid_srt"
