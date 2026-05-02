Feature: Transcribe an audio file

  Scenario: Reject missing file
    When the client posts to transcribe with no file
    Then the response status is 400
    And the response error code is "missing_file"

  Scenario: Reject unsupported extension
    When the client uploads a file named "notes.txt" to transcribe
    Then the response status is 400
    And the response error code is "unsupported_format"

  Scenario: Reject unsupported model size
    When the client uploads "clip.mp3" with model_size "huge"
    Then the response status is 400
    And the response error code is "unsupported_model"

  Scenario: Returns segments and srt for accepted file
    Given the transcriber will produce segments [(0.0, 1.5, "hello"), (1.5, 3.0, "world")]
    When the client uploads "clip.mp3" with model_size "base"
    Then the response status is 200
    And the response language is "en"
    And the response text is "hello\nworld"
    And the response srt contains "00:00:00,000 --> 00:00:01,500"
