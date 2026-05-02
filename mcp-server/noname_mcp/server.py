from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from noname_mcp import backend, pure

mcp = FastMCP("noname")


@mcp.tool()
def text_translate(text: str, source: str = "auto", target: str = "es") -> dict:
    """Translate text between English and Spanish using the local NMT engine.

    Args:
        text: The text to translate.
        source: Source language code: "en", "es", or "auto" (detect).
        target: Target language code: "en" or "es".
    Returns:
        {"text": str, "detected_source": str | None}
    """
    return backend.text_translate(text, source, target)


@mcp.tool()
def detect_language(text: str) -> str:
    """Detect whether the text is English or Spanish. Returns "en" or "es"."""
    result = backend.text_translate(text, "auto", "en")
    detected = result.get("detected_source")
    if detected:
        return detected
    return "en"


@mcp.tool()
def translate_srt_text(srt_content: str, source: str = "en", target: str = "es") -> str:
    """Translate the text inside an SRT subtitle file (timestamps preserved).

    Args:
        srt_content: The full text of the .srt file.
        source: Source language code: "en" or "es".
        target: Target language code: "en" or "es".
    Returns:
        The translated SRT as a string.
    """
    return backend.srt_translate_text(srt_content, source, target)


@mcp.tool()
def transcribe_audio(file_path: str, model_size: str = "base", language: str | None = None) -> dict:
    """Transcribe a local audio or video file via Whisper (faster-whisper, runs offline).

    Args:
        file_path: Absolute path to the audio/video file on this machine.
        model_size: One of "tiny", "base", "small", "medium". Larger = slower + more accurate.
        language: Force a specific language (e.g. "en", "es") or omit for auto-detect.
    Returns:
        {"language": str, "duration": float, "segments": [...], "text": str, "srt": str}
    """
    return backend.transcribe_audio(file_path, model_size=model_size, language=language)


@mcp.tool()
def translate_docx_file(file_path: str, source: str = "en", target: str = "es", output_dir: str | None = None) -> str:
    """Translate a .docx file (paragraph order preserved). Returns the saved output path.

    Args:
        file_path: Absolute path to the source .docx.
        source: "en" or "es".
        target: "en" or "es".
        output_dir: Where to write the result. Defaults to the same folder as the input.
    Returns:
        Absolute path to the translated .docx.
    """
    return backend.docx_translate(file_path, source=source, target=target, output_dir=output_dir)


@mcp.tool()
def http_send(method: str, url: str, headers: list[dict[str, str]] | None = None, body: str = "", body_type: str = "none") -> dict:
    """Send an HTTP request from the local machine and return the response.

    Args:
        method: GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS.
        url: Full URL.
        headers: List of {"key": str, "value": str, "enabled": bool} (defaults to []).
        body: Request body as a string.
        body_type: "none" | "raw" | "json" | "urlencoded".
    Returns:
        {"status": int, "status_text": str, "headers": dict, "body": str, "duration_ms": int, "size_bytes": int}
    """
    return backend.http_send(method, url, headers=headers, body=body, body_type=body_type)


@mcp.tool()
def hash_text(text: str, algorithm: str = "SHA-256") -> dict:
    """Compute a cryptographic hash of the given text. Pure stdlib, no backend.

    Args:
        text: The input string.
        algorithm: One of "MD5", "SHA-1", "SHA-256", "SHA-512".
    Returns:
        {"algorithm": str, "digest": str (hex)}
    """
    return {"algorithm": algorithm, "digest": pure.hash_text(text, algorithm)}


@mcp.tool()
def format_convert(text: str, from_format: str, to_format: str) -> str:
    """Convert between JSON, YAML, TOML, and CSV. Pure stdlib + libs, no backend.

    Args:
        text: Input document.
        from_format: "json" | "yaml" | "toml" | "csv".
        to_format: "json" | "yaml" | "toml" | "csv".
    Returns:
        The converted document as a string.
    """
    return pure.format_convert(text, from_format, to_format)


@mcp.tool()
def qr_to_ascii(text: str) -> str:
    """Generate an ASCII-art QR code suitable for printing in a terminal.

    Args:
        text: The text or URL to encode (max ~2000 chars).
    Returns:
        A multi-line string forming the QR.
    """
    return pure.qr_to_ascii(text)


@mcp.tool()
def generate_uuid(count: int = 1) -> list[str]:
    """Generate one or more UUID v4 values.

    Args:
        count: How many to generate (1..1000).
    Returns:
        A list of UUID strings.
    """
    return pure.generate_uuid(count)
