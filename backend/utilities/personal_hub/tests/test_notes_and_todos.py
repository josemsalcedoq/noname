import json
from datetime import timedelta
from pathlib import Path

import pytest
from django.test import Client
from django.utils import timezone
from pytest_bdd import given, parsers, scenarios, then, when

from utilities.personal_hub.models import Note, Todo

FEATURES_DIR = Path(__file__).parent / "features"
scenarios(str(FEATURES_DIR / "notes.feature"))
scenarios(str(FEATURES_DIR / "todos.feature"))
scenarios(str(FEATURES_DIR / "due.feature"))

pytestmark = pytest.mark.django_db


@pytest.fixture
def state():
    return {"response": None, "second_response": None, "note": None, "todo": None}


@pytest.fixture
def client():
    return Client()


@given('notes exist with titles "shopping list", "weekend plans", "recipe ideas"')
def _notes_exist(state):
    for title in ("shopping list", "weekend plans", "recipe ideas"):
        Note.objects.create(title=title, body="")


@given(parsers.parse('a note "{title}" exists'))
def _note_exists(state, title):
    state["note"] = Note.objects.create(title=title, body="")


@given(parsers.parse('an archived note "{title}" exists'))
def _archived_note_exists(state, title):
    state["note"] = Note.objects.create(title=title, body="", archived_at=timezone.now())


@given(parsers.parse('a todo "{title}" exists'))
def _todo_exists(state, title):
    state["todo"] = Todo.objects.create(title=title)


@given(parsers.parse('a completed todo "{title}" exists'))
def _completed_todo_exists(state, title):
    state["todo"] = Todo.objects.create(title=title, completed_at=timezone.now())


@given(parsers.parse('a todo "{title}" with remind_at {seconds:d} seconds from now exists'))
def _todo_with_remind(state, title, seconds):
    state["todo"] = Todo.objects.create(
        title=title, remind_at=timezone.now() + timedelta(seconds=seconds)
    )


@given(parsers.parse('a todo "{title}" with remind_at 1 minute from now exists'))
def _todo_with_remind_1min(state, title):
    state["todo"] = Todo.objects.create(
        title=title, remind_at=timezone.now() + timedelta(minutes=1)
    )


@given(parsers.parse('a completed todo "{title}" with remind_at {seconds:d} seconds from now exists'))
def _completed_todo_with_remind(state, title, seconds):
    state["todo"] = Todo.objects.create(
        title=title,
        remind_at=timezone.now() + timedelta(seconds=seconds),
        completed_at=timezone.now(),
    )


@when(parsers.parse('the client posts a note with title "{title}" and body "{body}"'))
def _post_note(state, client, title, body):
    state["response"] = client.post(
        "/api/personal-hub/notes",
        data=json.dumps({"title": title, "body": body, "tags": []}),
        content_type="application/json",
    )


@when(parsers.parse('the client posts a note with title "{title}" and a body of {size:d} characters'))
def _post_oversize_note(state, client, title, size):
    state["response"] = client.post(
        "/api/personal-hub/notes",
        data=json.dumps({"title": title, "body": "x" * size, "tags": []}),
        content_type="application/json",
    )


@when(parsers.parse('the client posts a note with title "{title}" and {count:d} tags'))
def _post_note_with_tags(state, client, title, count):
    state["response"] = client.post(
        "/api/personal-hub/notes",
        data=json.dumps({"title": title, "body": "", "tags": [f"t{i}" for i in range(count)]}),
        content_type="application/json",
    )


@when(parsers.parse('the client searches notes for "{query}"'))
def _search_notes(state, client, query):
    state["response"] = client.get(f"/api/personal-hub/notes?q={query}")


@when("the client archives the note")
def _archive_note(state, client):
    state["response"] = client.post(f"/api/personal-hub/notes/{state['note'].id}/archive")


@when("the client unarchives the note")
def _unarchive_note(state, client):
    state["response"] = client.post(f"/api/personal-hub/notes/{state['note'].id}/unarchive")


@when("the client deletes the note")
def _delete_note(state, client):
    state["response"] = client.delete(f"/api/personal-hub/notes/{state['note'].id}")


@when(parsers.parse('the client posts a todo with title "{title}"'))
def _post_todo(state, client, title):
    state["response"] = client.post(
        "/api/personal-hub/todos",
        data=json.dumps({"title": title, "body": "", "tags": []}),
        content_type="application/json",
    )


@when("the client posts a todo where remind_at is later than due_at")
def _post_invalid_todo(state, client):
    now = timezone.now()
    state["response"] = client.post(
        "/api/personal-hub/todos",
        data=json.dumps(
            {
                "title": "x",
                "body": "",
                "tags": [],
                "due_at": (now + timedelta(hours=1)).isoformat(),
                "remind_at": (now + timedelta(hours=2)).isoformat(),
            }
        ),
        content_type="application/json",
    )


@when("the client completes the todo")
def _complete_todo(state, client):
    state["response"] = client.post(f"/api/personal-hub/todos/{state['todo'].id}/complete")


@when("the client reopens the todo")
def _reopen_todo(state, client):
    state["response"] = client.post(f"/api/personal-hub/todos/{state['todo'].id}/reopen")


@when(parsers.parse("the client snoozes the todo for {minutes:d} minutes"))
def _snooze_todo(state, client, minutes):
    state["response"] = client.post(
        f"/api/personal-hub/todos/{state['todo'].id}/snooze",
        data=json.dumps({"minutes": minutes}),
        content_type="application/json",
    )


@when(parsers.parse("the client polls due reminders within {seconds:d} seconds"))
def _poll_due(state, client, seconds):
    response = client.get(f"/api/personal-hub/due?within={seconds}")
    if state["response"] is None:
        state["response"] = response
    else:
        state["second_response"] = response


@when(parsers.parse("the client polls due reminders within {seconds:d} seconds again"))
def _poll_due_again(state, client, seconds):
    state["second_response"] = client.get(f"/api/personal-hub/due?within={seconds}")


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code


@then(parsers.parse('the note list contains a note with title "{title}"'))
def _note_list_contains(state, client, title):
    response = client.get("/api/personal-hub/notes")
    titles = [n["title"] for n in response.json()]
    assert title in titles


@then(parsers.parse('the search response contains a note with title "{title}"'))
def _search_response_contains(state, title):
    titles = [n["title"] for n in state["response"].json()]
    assert title in titles


@then(parsers.parse("the search response has {count:d} entry"))
def _search_response_count(state, count):
    assert len(state["response"].json()) == count


@then("the active note list is empty")
def _active_notes_empty(state, client):
    response = client.get("/api/personal-hub/notes")
    assert response.json() == []


@then(parsers.parse("the active note list has {count:d} entry"))
def _active_notes_count(state, client, count):
    response = client.get("/api/personal-hub/notes")
    assert len(response.json()) == count


@then(parsers.parse("the archived note list has {count:d} entry"))
def _archived_notes_count(state, client, count):
    response = client.get("/api/personal-hub/notes?archived=true")
    assert len(response.json()) == count


@then("the archived note list is empty")
def _archived_notes_empty(state, client):
    response = client.get("/api/personal-hub/notes?archived=true")
    assert response.json() == []


@then(parsers.parse('the open todo list contains a todo with title "{title}"'))
def _open_todos_contains(state, client, title):
    response = client.get("/api/personal-hub/todos?status=open")
    titles = [t["title"] for t in response.json()]
    assert title in titles


@then("the open todo list is empty")
def _open_todos_empty(state, client):
    response = client.get("/api/personal-hub/todos?status=open")
    assert response.json() == []


@then(parsers.parse("the open todo list has {count:d} entry"))
def _open_todos_count(state, client, count):
    response = client.get("/api/personal-hub/todos?status=open")
    assert len(response.json()) == count


@then(parsers.parse("the done todo list has {count:d} entry"))
def _done_todos_count(state, client, count):
    response = client.get("/api/personal-hub/todos?status=done")
    assert len(response.json()) == count


@then(parsers.parse("the todo's remind_at is more than {minutes:d} minutes from now"))
def _todo_remind_at_pushed(state, minutes):
    state["todo"].refresh_from_db()
    delta = state["todo"].remind_at - timezone.now()
    assert delta.total_seconds() > minutes * 60


@then(parsers.parse('the response includes "{title}"'))
def _response_includes(state, title):
    titles = [r["title"] for r in state["response"].json()["reminders"]]
    assert title in titles


@then("the response is empty")
def _response_empty(state):
    assert state["response"].json()["reminders"] == []


@then("the second response is empty")
def _second_response_empty(state):
    assert state["second_response"].json()["reminders"] == []
