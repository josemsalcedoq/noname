Feature: Install and uninstall

  Scenario: Install creates the skill folder
    Given the upstream catalog has "frontend-design"
    When the client installs "frontend-design"
    Then the response status is 201
    And the skill folder for "frontend-design" exists locally

  Scenario: Reinstall is idempotent
    Given "frontend-design" is installed locally
    When the client installs "frontend-design"
    Then the response status is 201

  Scenario: Uninstall removes the folder
    Given "frontend-design" is installed locally
    When the client uninstalls "frontend-design"
    Then the response status is 204
    And the skill folder for "frontend-design" does not exist

  Scenario: Uninstall a missing skill returns 404
    When the client uninstalls "nope"
    Then the response status is 404

  Scenario: Reject malicious install names
    When the client installs "..etc"
    Then the response status is 400
    And the response error code is "invalid_name"

  Scenario: Reject malicious uninstall names
    When the client uninstalls "..weird"
    Then the response status is 400
