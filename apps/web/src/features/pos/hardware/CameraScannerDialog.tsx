import { useEffect, useRef, useState } from "react";

export function CameraScannerDialog({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;

    let active = true;
    async function startCamera() {
      setCameraError("");
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported in this browser");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => null);
        }
        setStreamActive(true);
      } catch (err) {
        setStreamActive(false);
        setCameraError(
          err instanceof Error
            ? err.message
            : "Unable to access camera. You can test barcode/QR scanning below.",
        );
      }
    }

    void startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setStreamActive(false);
    };
  }, [open, facingMode]);

  if (!open) return null;

  function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && "applyConstraints" in track) {
      const next = !torchOn;
      // @ts-expect-error - advanced constraints
      track.applyConstraints({ advanced: [{ torch: next }] }).catch(() => null);
      setTorchOn(next);
    }
  }

  function handleTriggerScan(code: string) {
    if (!code.trim()) return;
    onScan(code.trim());
    onClose();
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal max-w-lg p-5 text-left"
        role="dialog"
        aria-modal
        aria-label="Camera & QR Scanner"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <i className="fa-solid fa-camera text-base" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Camera & QR Scanner</h2>
              <p className="text-xs text-slate-500">
                Point camera at 1D barcode or 2D QR code on product
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative my-3.5 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-inner">
          <div className="relative flex aspect-video w-full items-center justify-center">
            {streamActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="p-4 text-center space-y-2">
                <i className="fa-solid fa-video-slash text-3xl text-slate-500" />
                <p className="text-xs font-semibold text-slate-300">
                  {cameraError || "Initializing camera stream…"}
                </p>
              </div>
            )}

            {/* Target Reticle & Animated Laser Line */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-40 w-64 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                {/* Corner Accents */}
                <span className="absolute -left-1 -top-1 h-4 w-4 border-l-4 border-t-4 border-emerald-400" />
                <span className="absolute -right-1 -top-1 h-4 w-4 border-r-4 border-t-4 border-emerald-400" />
                <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-emerald-400" />
                <span className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-emerald-400" />

                {/* Scanning Laser Line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
              </div>
            </div>
          </div>

          {/* Camera Controls Overlay */}
          <div className="flex items-center justify-between bg-slate-900/90 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-bold text-slate-300">Scan Active</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTorch}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition ${
                  torchOn ? "bg-amber-400 text-slate-950 border-amber-400" : "bg-slate-800 text-slate-200 border-slate-700"
                }`}
              >
                <i className="fa-solid fa-lightbulb mr-1" />
                Torch
              </button>
              <button
                type="button"
                onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
                className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700"
              >
                <i className="fa-solid fa-camera-rotate mr-1" />
                Flip
              </button>
            </div>
          </div>
        </div>

        {/* Test Barcode / QR Simulation Triggers */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Quick Test Scans:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "AC-1.5T (Barcode)", code: "ORI-INV-15T" },
              { label: "LED Bulb (Barcode)", code: "LED-12W-E27" },
              { label: "Copper Cable (SKU)", code: "CAB-CU-4MM" },
              { label: "Unknown Item (999)", code: "UNKNOWN-999" },
            ].map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => handleTriggerScan(s.code)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-blue-500 hover:bg-blue-50"
              >
                <i className="fa-solid fa-barcode mr-1 text-slate-400" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Manual input trigger */}
          <div className="flex gap-2 pt-1 border-t border-slate-200/60">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTriggerScan(manualCode)}
              placeholder="Or type/paste Barcode or QR payload…"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleTriggerScan(manualCode)}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
