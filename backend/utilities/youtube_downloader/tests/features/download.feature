Feature: YouTube downloader job lifecycle

  Scenario: Reject non-YouTube probe URL
    When the client probes the URL "https://example.com/foo"
    Then the response status is 400
    And the response error code is "unsupported_host"

  Scenario: Reject non-YouTube download URL
    When the client requests a download for "https://example.com/foo" with mode "video" and quality "720p"
    Then the response status is 400
    And the response error code is "unsupported_host"

  Scenario: Reject invalid quality for video mode
    When the client requests a download for "https://www.youtube.com/watch?v=abc" with mode "video" and quality "audio-192k"
    Then the response status is 400

  Scenario: Cancellable job becomes cancelled
    Given a running job exists for "https://www.youtube.com/watch?v=abc"
    When the client cancels the job
    Then the response status is 200
    And the job status is "cancelled"

  Scenario: Cancelling a finished job is rejected
    Given a finished job exists for "https://www.youtube.com/watch?v=abc"
    When the client cancels the job
    Then the response status is 409
    And the response error code is "not_cancellable"
