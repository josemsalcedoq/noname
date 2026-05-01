Feature: Personal hub — due reminders polling

  Scenario: Returns todos with remind_at within window
    Given a todo "ping" with remind_at 30 seconds from now exists
    When the client polls due reminders within 300 seconds
    Then the response includes "ping"

  Scenario: Cooldown prevents double-firing
    Given a todo "ping" with remind_at 30 seconds from now exists
    When the client polls due reminders within 300 seconds
    And the client polls due reminders within 300 seconds again
    Then the second response is empty

  Scenario: Completed todos are excluded
    Given a completed todo "done" with remind_at 30 seconds from now exists
    When the client polls due reminders within 300 seconds
    Then the response is empty
