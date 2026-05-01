import { useEffect, useState } from "react";
import QRCode from "qrcode";

const MAX_LENGTH = 2_000;

export function QrTab() {
  const [text, setText] = useState("https://example.com");
  const [pngDataUrl, setPngDataUrl] = useState("");
  const [svgString, setSvgString] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!text) {
      setPngDataUrl("");
      setSvgString("");
      return;
    }
    if (text.length > MAX_LENGTH) {
      setError(`Maximum length is ${MAX_LENGTH} characters.`);
      setPngDataUrl("");
      setSvgString("");
      return;
    }
    Promise.all([
      QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, scale: 8 }),
      QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1 }),
    ])
      .then(([png, svg]) => {
        if (cancelled) return;
        setPngDataUrl(png);
        setSvgString(svg);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[12rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
          data-testid="qr-input"
        />
        <p className="font-mono text-[10px] text-subtle text-right">
          {text.length} / {MAX_LENGTH}
        </p>
        {error ? <p className="font-mono text-xs text-error" role="alert">{error}</p> : null}
      </div>

      <div className="space-y-3">
        {pngDataUrl ? (
          <img src={pngDataUrl} alt="QR code" className="bg-fg p-3 rounded-sm" width={224} height={224} data-testid="qr-image" />
        ) : null}
        {pngDataUrl ? (
          <div className="flex gap-2 font-mono text-xs">
            <a href={pngDataUrl} download="qr.png" className="px-3 py-1.5 border border-border hover:border-accent rounded-sm">
              .png
            </a>
            <a
              href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`}
              download="qr.svg"
              className="px-3 py-1.5 border border-border hover:border-accent rounded-sm"
            >
              .svg
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
