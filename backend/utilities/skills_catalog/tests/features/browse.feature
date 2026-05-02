Feature: Skills catalog browsing

  Scenario: Catalog lists upstream skills with installed status
    Given the upstream catalog has "frontend-design" and "claude-api"
    And "frontend-design" is installed locally
    When the client fetches the catalog
    Then the response status is 200
    And the entry "frontend-design" is marked installed
    And the entry "claude-api" is marked not installed

  Scenario: Cache hit avoids upstream calls
    Given the catalog has been fetched once
    When the client fetches the catalog again
    Then no upstream HTTP call is made on the second fetch

  Scenario: Refresh bypasses the cache
    Given the catalog has been fetched once
    When the client fetches the catalog with refresh=true
    Then an upstream HTTP call is made on the refresh
