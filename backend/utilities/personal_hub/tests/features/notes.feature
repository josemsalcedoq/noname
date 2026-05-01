Feature: Personal hub — notes CRUD

  Scenario: Create a note
    When the client posts a note with title "groceries" and body "milk-bread"
    Then the response status is 201
    And the note list contains a note with title "groceries"

  Scenario: Reject body over the size limit
    When the client posts a note with title "x" and a body of 50001 characters
    Then the response status is 400

  Scenario: Reject more than 10 tags
    When the client posts a note with title "x" and 11 tags
    Then the response status is 400

  Scenario: Search notes by title
    Given notes exist with titles "shopping list", "weekend plans", "recipe ideas"
    When the client searches notes for "weekend"
    Then the search response has 1 entry
    And the search response contains a note with title "weekend plans"

  Scenario: Archive hides from default list
    Given a note "draft" exists
    When the client archives the note
    Then the response status is 200
    And the active note list is empty
    And the archived note list has 1 entry

  Scenario: Delete a note
    Given a note "ephemeral" exists
    When the client deletes the note
    Then the response status is 204
    And the active note list is empty

  Scenario: Unarchive a previously-archived note
    Given an archived note "shelved" exists
    When the client unarchives the note
    Then the response status is 200
    And the active note list has 1 entry
    And the archived note list is empty

  Scenario: Delete an archived note
    Given an archived note "shelved" exists
    When the client deletes the note
    Then the response status is 204
    And the archived note list is empty
