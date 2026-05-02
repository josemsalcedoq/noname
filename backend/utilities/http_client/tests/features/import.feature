Feature: Import Postman v2.1 collection

  Scenario: Import collection with one folder containing two requests
    Given a Postman v2.1 payload with collection "API" and folder "users" containing requests "list" and "get"
    When the client posts the payload to import
    Then the response status is 201
    And the collection tree has folder "users" with 2 requests

  Scenario: Preserve placeholder syntax in URL
    Given a Postman v2.1 payload with a request whose url is "{{host}}/users/{{id}}"
    When the client posts the payload to import
    Then the imported request url is "{{host}}/users/{{id}}"

  Scenario: Reject non-Postman JSON
    Given a JSON payload without an info object
    When the client posts the payload to import
    Then the response status is 400
    And the response error code is "not_postman_v21"
