from pathlib import Path

import pytest
from django.core.cache import cache
from django.test import Client, override_settings
from pytest_bdd import given, parsers, scenarios, then, when

FEATURES_DIR = Path(__file__).parent / "features"
scenarios(str(FEATURES_DIR / "browse.feature"))
scenarios(str(FEATURES_DIR / "install.feature"))
scenarios(str(FEATURES_DIR / "steps.feature"))


def _frontmatter(name: str) -> str:
    return f"---\nname: {name}\ndescription: a test skill called {name}\nlicense: MIT\n---\nbody"


@pytest.fixture
def state(tmp_path, monkeypatch):
    cache.clear()
    fake_skills_dir = tmp_path / ".claude" / "skills"
    fake_skills_dir.mkdir(parents=True)

    holder = {
        "skills_dir": fake_skills_dir,
        "fetch_count": 0,
        "second_fetch_count_baseline": 0,
        "response": None,
        "upstream_skills": [],
    }

    def fake_get(url: str, timeout: int = 10):
        holder["fetch_count"] += 1

        class Response:
            def __init__(self, payload, *, text=None, status=200):
                self._payload = payload
                self.text = text or ""
                self.status_code = status

            def json(self):
                return self._payload

            def raise_for_status(self):
                if self.status_code >= 400:
                    raise RuntimeError(f"upstream {self.status_code}")

        if "api.github.com" in url:
            return Response([{"name": s, "type": "dir"} for s in holder["upstream_skills"]])
        for skill in holder["upstream_skills"]:
            if url.endswith(f"/skills/{skill}/SKILL.md"):
                return Response(None, text=_frontmatter(skill))
        return Response(None, text="", status=404)

    def fake_install(name: str):
        target = fake_skills_dir / name
        if target.exists():
            import shutil

            shutil.rmtree(target)
        target.mkdir(parents=True)
        (target / "SKILL.md").write_text(_frontmatter(name))

    monkeypatch.setattr("utilities.skills_catalog.services.requests.get", fake_get)
    monkeypatch.setattr("utilities.skills_catalog.services.install", fake_install)

    return holder


@pytest.fixture
def client(state):
    settings_override = override_settings(SKILLS_DIR=state["skills_dir"])
    settings_override.enable()
    yield Client()
    settings_override.disable()


@given(parsers.parse('the upstream catalog has "{a}" and "{b}"'))
def _upstream_two(state, a, b):
    state["upstream_skills"] = [a, b]


@given(parsers.parse('the upstream catalog has "{a}"'))
def _upstream_one(state, a):
    state["upstream_skills"] = [a]


@given(parsers.parse('"{name}" is installed locally'))
def _installed_locally(state, name):
    target = state["skills_dir"] / name
    target.mkdir(parents=True, exist_ok=True)
    (target / "SKILL.md").write_text(_frontmatter(name))


@given("the catalog has been fetched once")
def _fetched_once(state, client):
    if not state["upstream_skills"]:
        state["upstream_skills"] = ["frontend-design"]
    client.get("/api/skills/catalog")
    state["second_fetch_count_baseline"] = state["fetch_count"]


@when("the client fetches the catalog")
def _fetch_catalog(state, client):
    state["response"] = client.get("/api/skills/catalog")


@when("the client fetches the catalog again")
def _fetch_catalog_again(state, client):
    state["response"] = client.get("/api/skills/catalog")


@when("the client fetches the catalog with refresh=true")
def _fetch_catalog_refresh(state, client):
    state["response"] = client.get("/api/skills/catalog?refresh=true")


@when(parsers.parse('the client installs "{name}"'))
def _install(state, client, name):
    state["response"] = client.post(f"/api/skills/installed/{name}")


@when(parsers.parse('the client uninstalls "{name}"'))
def _uninstall(state, client, name):
    state["response"] = client.delete(f"/api/skills/installed/{name}")


@when(parsers.parse('the client requests install steps for "{name}"'))
def _steps(state, client, name):
    state["response"] = client.get(f"/api/skills/install-steps/{name}")


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code, state["response"].content


@then(parsers.parse('the entry "{name}" is marked installed'))
def _entry_installed(state, name):
    skills = state["response"].json()["skills"]
    entry = next(s for s in skills if s["name"] == name)
    assert entry["installed"] is True


@then(parsers.parse('the entry "{name}" is marked not installed'))
def _entry_not_installed(state, name):
    skills = state["response"].json()["skills"]
    entry = next(s for s in skills if s["name"] == name)
    assert entry["installed"] is False


@then("no upstream HTTP call is made on the second fetch")
def _no_extra_call(state):
    assert state["fetch_count"] == state["second_fetch_count_baseline"]


@then("an upstream HTTP call is made on the refresh")
def _extra_call(state):
    assert state["fetch_count"] > state["second_fetch_count_baseline"]


@then(parsers.parse('the skill folder for "{name}" exists locally'))
def _folder_exists(state, name):
    assert (state["skills_dir"] / name).is_dir()


@then(parsers.parse('the skill folder for "{name}" does not exist'))
def _folder_missing(state, name):
    assert not (state["skills_dir"] / name).exists()


@then(parsers.parse('the response error code is "{code}"'))
def _error_code(state, code):
    assert state["response"].json()["error"] == code


@then(parsers.parse('the steps include "{fragment}"'))
def _steps_include(state, fragment):
    body = state["response"].json()
    assert any(fragment in step for step in body["steps"]), body


@then("the oneliner is non-empty")
def _oneliner_nonempty(state):
    assert state["response"].json()["oneliner"]
