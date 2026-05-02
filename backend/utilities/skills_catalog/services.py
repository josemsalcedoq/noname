from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import requests
from django.conf import settings
from django.core.cache import cache

NAME_RE = re.compile(r"^[a-z0-9_-]+$")
GITHUB_API = "https://api.github.com/repos/anthropics/skills/contents/skills"
RAW_SKILL_MD = "https://raw.githubusercontent.com/anthropics/skills/main/skills/{name}/SKILL.md"
HTML_BASE = "https://github.com/anthropics/skills/tree/main/skills"
SKILL_MD_HTML_BASE = "https://github.com/anthropics/skills/blob/main/skills"
REPO_GIT_URL = "https://github.com/anthropics/skills.git"

CACHE_KEY = "skills_catalog:v1"
CACHE_TTL = 3600


class InvalidSkillName(Exception):
    pass


class SkillNotFound(Exception):
    pass


@dataclass(frozen=True)
class CatalogEntry:
    name: str
    description: str
    license: str
    html_url: str
    skill_md_url: str

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "license": self.license,
            "html_url": self.html_url,
            "skill_md_url": self.skill_md_url,
        }


def validate_name(name: str) -> None:
    if not NAME_RE.fullmatch(name):
        raise InvalidSkillName(name)


def is_installed(name: str) -> bool:
    return _resolve_install_path(name).is_dir()


def install_path(name: str) -> Path:
    return _resolve_install_path(name)


def list_installed_names() -> set[str]:
    skills_dir: Path = settings.SKILLS_DIR
    if not skills_dir.is_dir():
        return set()
    return {entry.name for entry in skills_dir.iterdir() if entry.is_dir()}


def fetch_catalog(*, refresh: bool = False) -> list[CatalogEntry]:
    if not refresh:
        cached = cache.get(CACHE_KEY)
        if cached is not None:
            return [CatalogEntry(**entry) for entry in cached]

    entries = _fetch_remote_catalog()
    cache.set(CACHE_KEY, [entry.to_dict() for entry in entries], CACHE_TTL)
    return entries


def get_install_steps(name: str) -> dict:
    validate_name(name)
    steps = [
        "mkdir -p ~/.claude/skills",
        'tmp="$(mktemp -d)"',
        f'git clone --depth 1 --filter=blob:none --sparse {REPO_GIT_URL} "$tmp"',
        f'(cd "$tmp" && git sparse-checkout set skills/{name})',
        f'cp -R "$tmp/skills/{name}" ~/.claude/skills/',
        'rm -rf "$tmp"',
    ]
    oneliner = " && ".join(steps)
    return {"name": name, "steps": steps, "oneliner": oneliner}


def install(name: str) -> None:
    validate_name(name)
    skills_dir: Path = settings.SKILLS_DIR
    skills_dir.mkdir(parents=True, exist_ok=True)
    target = _resolve_install_path(name)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "--filter=blob:none",
                "--sparse",
                REPO_GIT_URL,
                str(tmp_path),
            ],
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "sparse-checkout", "set", f"skills/{name}"],
            cwd=tmp_path,
            check=True,
            capture_output=True,
        )
        source = tmp_path / "skills" / name
        if not source.is_dir():
            raise SkillNotFound(name)
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)


def uninstall(name: str) -> None:
    validate_name(name)
    target = _resolve_install_path(name)
    if not target.exists():
        raise SkillNotFound(name)
    shutil.rmtree(target)


def _resolve_install_path(name: str) -> Path:
    validate_name(name)
    skills_dir: Path = settings.SKILLS_DIR
    candidate = (skills_dir / name).resolve()
    skills_dir_resolved = skills_dir.resolve()
    if skills_dir_resolved not in candidate.parents and candidate != skills_dir_resolved:
        raise InvalidSkillName(name)
    return candidate


def _fetch_remote_catalog() -> list[CatalogEntry]:
    response = requests.get(GITHUB_API, timeout=10)
    response.raise_for_status()
    folders = [item["name"] for item in response.json() if item.get("type") == "dir"]
    entries: list[CatalogEntry] = []
    for folder in folders:
        try:
            md_response = requests.get(RAW_SKILL_MD.format(name=folder), timeout=10)
            md_response.raise_for_status()
            frontmatter = _parse_frontmatter(md_response.text)
        except requests.RequestException:
            frontmatter = {}
        entries.append(
            CatalogEntry(
                name=folder,
                description=frontmatter.get("description", ""),
                license=frontmatter.get("license", ""),
                html_url=f"{HTML_BASE}/{folder}",
                skill_md_url=f"{SKILL_MD_HTML_BASE}/{folder}/SKILL.md",
            )
        )
    return sorted(entries, key=lambda e: e.name)


def _parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    block = text[3:end].strip()
    result: dict[str, str] = {}
    for line in block.splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        key, _, value = line.partition(":")
        result[key.strip()] = value.strip().strip("'\"")
    return result
