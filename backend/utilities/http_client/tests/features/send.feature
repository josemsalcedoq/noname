Feature: Send an HTTP request

  Scenario: Variable interpolation expands env vars in URL and headers
    Given an environment "dev" with variables host="example.test" and token="abc123"
    When the client sends GET to "https://{{host}}/v1/users" with header "Authorization=Bearer {{token}}" using environment "dev"
    Then the upstream received URL is "https://example.test/v1/users"
    And the upstream received header "Authorization" equals "Bearer abc123"

  Scenario: Unknown variables are surfaced
    When the client sends GET to "https://{{nope}}/" with no environment
    Then the response unknown_vars contains "nope"

  Scenario: Network failure surfaces as 502
    When the client sends GET to "https://example.invalid/"
    Then the response status is 502
    And the response error code is "upstream_unreachable"

  Scenario: JSON body sets Content-Type when missing
    When the client sends POST to "https://example.test/v1/items" with json body "{\"id\":1}"
    Then the upstream received header "Content-Type" equals "application/json"
