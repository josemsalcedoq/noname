Feature: Install steps autocopy

  Scenario: Returns shell snippet referencing the skill name
    When the client requests install steps for "frontend-design"
    Then the response status is 200
    And the steps include "skills/frontend-design"
    And the oneliner is non-empty

  Scenario: Reject invalid names in steps
    When the client requests install steps for "..bad"
    Then the response status is 400
