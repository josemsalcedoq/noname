Feature: Personal hub — todos lifecycle

  Scenario: Create an open todo
    When the client posts a todo with title "review PR"
    Then the response status is 201
    And the open todo list contains a todo with title "review PR"

  Scenario: Reject remind_at after due_at
    When the client posts a todo where remind_at is later than due_at
    Then the response status is 400

  Scenario: Complete moves todo to done
    Given a todo "buy milk" exists
    When the client completes the todo
    Then the open todo list is empty
    And the done todo list has 1 entry

  Scenario: Reopen brings todo back to open
    Given a completed todo "buy milk" exists
    When the client reopens the todo
    Then the open todo list has 1 entry

  Scenario: Snooze pushes remind_at by N minutes
    Given a todo "stretch" with remind_at 1 minute from now exists
    When the client snoozes the todo for 10 minutes
    Then the response status is 200
    And the todo's remind_at is more than 10 minutes from now
