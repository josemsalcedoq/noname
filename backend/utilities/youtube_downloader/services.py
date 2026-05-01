from __future__ import annotations

import os
import re
import shlex
import signal
import subprocess
import threading
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yt_dlp
from django.conf import settings
from django.utils import timezone

from .models import YoutubeJob

YOUTUBE_HOSTS = {"www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"}
PROGRESS_RE = re.compile(r"\[download\]\s+(?P<percent>\d+\.?\d*)%")


def is_youtube_url(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
    except ValueError:
        return False
    return host in YOUTUBE_HOSTS


def probe(url: str) -> dict[str, Any]:
    options = {"quiet": True, "skip_download": True, "noprogress": True}
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "title": info.get("title"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "uploader": info.get("uploader"),
        "available_qualities": _summarize_qualities(info.get("formats") or []),
    }


def _summarize_qualities(formats: list[dict[str, Any]]) -> list[str]:
    heights = sorted({f.get("height") for f in formats if f.get("height")}, reverse=True)
    return [f"{h}p" for h in heights]


def build_args(job: YoutubeJob, output_dir: Path) -> list[str]:
    output_template = str(output_dir / "%(title)s.%(ext)s")
    args = [
        "yt-dlp",
        "--newline",
        "--restrict-filenames",
        "-N",
        "8",
        "--http-chunk-size",
        "10M",
        "--no-mtime",
        "-o",
        output_template,
    ]
    if job.mode == YoutubeJob.Mode.AUDIO:
        bitrate = job.quality.removeprefix("audio-").removesuffix("k") or "192"
        args += ["-x", "--audio-format", "mp3", "--audio-quality", bitrate]
    else:
        if job.quality == "best":
            video_fmt = "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        else:
            height = job.quality.removesuffix("p")
            video_fmt = (
                f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]"
                f"/best[height<={height}][ext=mp4]/best[height<={height}]"
            )
        args += ["-f", video_fmt, "--merge-output-format", "mp4"]
    args.append(job.url)
    return args


def start_download(job: YoutubeJob) -> None:
    output_dir = Path(settings.DOWNLOAD_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    thread = threading.Thread(target=_run, args=(job.id, output_dir), daemon=True)
    thread.start()


def _run(job_id, output_dir: Path) -> None:
    from django.db import connection

    job = YoutubeJob.objects.get(id=job_id)
    args = build_args(job, output_dir)
    proc = subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    job.pid = proc.pid
    job.status = YoutubeJob.Status.RUNNING
    job.save(update_fields=["pid", "status"])

    last_line = ""
    output_file: str | None = None
    if proc.stdout is not None:
        for line in proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            last_line = line
            match = PROGRESS_RE.search(line)
            if match:
                job.progress = float(match.group("percent"))
                job.save(update_fields=["progress"])
                continue
            destination = _extract_destination(line)
            if destination:
                output_file = destination

    return_code = proc.wait()
    job.refresh_from_db()
    if job.status == YoutubeJob.Status.CANCELLED:
        connection.close()
        return

    job.finished_at = timezone.now()
    if return_code == 0:
        job.status = YoutubeJob.Status.DONE
        if output_file:
            job.file_path = output_file
        job.progress = 100.0
    else:
        job.status = YoutubeJob.Status.ERROR
        job.error = last_line or f"yt-dlp exited with code {return_code}"
    job.save()
    connection.close()


def _extract_destination(line: str) -> str | None:
    for marker in ("[download] Destination: ", "[Merger] Merging formats into "):
        if marker in line:
            return line.split(marker, 1)[1].strip().strip('"')
    return None


def cancel(job: YoutubeJob) -> None:
    if job.pid:
        try:
            os.kill(job.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    job.status = YoutubeJob.Status.CANCELLED
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "finished_at"])


def args_to_string(args: list[str]) -> str:
    return " ".join(shlex.quote(a) for a in args)
