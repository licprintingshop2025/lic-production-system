"use client";

import type { DocumentItem } from "@/lib/orders/types";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

export type ATPExtraction = {
  dateOfAtp: string;
  ocn: string;
  tin: string;
  taxpayerName: string;
  businessName: string;
  registeredAddress: string;
  rdoCode: string;
  taxType: "VAT" | "NON-VAT" | "";
  documents: Omit<DocumentItem, "id">[];
  overallConfidence: "high" | "medium" | "low";
  warnings: string[];
};

type Props = {
  disabled?: boolean;
  onApply: (extraction: ATPExtraction) => void;
};

type QRScanResult = {
  status: "idle" | "scanning" | "detected" | "not-found" | "error";
  rawValue: string;
  url: string;
  officialBir: boolean;
  message: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 2400;
const TARGET_UPLOAD_SIZE = 2.5 * 1024 * 1024;
const JPEG_QUALITY = 0.86;
const EXTRACTION_TIMEOUT_MS = 90_000;
const QR_MAX_DIMENSION = 1800;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const EMPTY_QR_RESULT: QRScanResult = {
  status: "idle",
  rawValue: "",
  url: "",
  officialBir: false,
  message: "",
};

export default function ATPScannerPanel({ disabled = false, onApply }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const selectionSequenceRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [optimizedFile, setOptimizedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<ATPExtraction | null>(null);
  const [applied, setApplied] = useState(false);
  const [qrResult, setQrResult] = useState<QRScanResult>(EMPTY_QR_RESULT);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(file);

    setPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  async function selectFile(nextFile?: File) {
    if (!nextFile) {
      return;
    }

    const selectionId = ++selectionSequenceRef.current;

    setError("");
    setExtraction(null);
    setApplied(false);
    setOptimizedFile(null);
    setImageViewerOpen(false);

    setQrResult({
      ...EMPTY_QR_RESULT,
      status: "scanning",
      message: "Scanning QR code…",
    });

    if (!ACCEPTED_TYPES.has(nextFile.type)) {
      setFile(null);

      setError("Please use a JPG, PNG, or WEBP image.");

      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);

      setError("ATP image must be 10 MB or smaller.");

      return;
    }

    setFile(nextFile);
    setOptimizing(true);

    void decodeATPQRCode(nextFile).then((result) => {
      if (selectionId !== selectionSequenceRef.current) {
        return;
      }

      setQrResult(result);
    });

    try {
      const preparedFile = await prepareImageForExtraction(nextFile);

      if (selectionId !== selectionSequenceRef.current) {
        return;
      }

      setOptimizedFile(preparedFile);
    } catch (imageError) {
      console.error("ATP image optimization failed:", imageError);

      if (selectionId !== selectionSequenceRef.current) {
        return;
      }

      setOptimizedFile(nextFile);
    } finally {
      if (selectionId === selectionSequenceRef.current) {
        setOptimizing(false);
      }
    }
  }

  function clearScan() {
    selectionSequenceRef.current += 1;

    setFile(null);
    setOptimizedFile(null);
    setExtraction(null);
    setError("");
    setApplied(false);
    setOptimizing(false);
    setExtracting(false);
    setImageViewerOpen(false);
    setQrResult(EMPTY_QR_RESULT);

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  async function extractATP() {
    const fileToSend = optimizedFile || file;

    if (!fileToSend || extracting || optimizing) {
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, EXTRACTION_TIMEOUT_MS);

    try {
      setExtracting(true);
      setError("");
      setExtraction(null);
      setApplied(false);

      const body = new FormData();

      body.append("file", fileToSend);

      const response = await fetch("/api/atp/extract", {
        method: "POST",
        body,
        signal: controller.signal,
      });

      const result = await readJsonResponse(response);

      if (!response.ok) {
        setError(
          typeof result?.error === "string"
            ? result.error
            : "Failed to read the ATP image. Please try again.",
        );

        return;
      }

      if (!result?.extraction) {
        setError(
          "The extraction service returned no ATP data. Please try again.",
        );

        return;
      }

      setExtraction(result.extraction as ATPExtraction);
    } catch (scanError) {
      console.error("ATP extraction failed:", scanError);

      if (
        scanError instanceof DOMException &&
        scanError.name === "AbortError"
      ) {
        setError(
          "Reading the ATP took too long. Check your connection and try again.",
        );
      } else {
        setError(
          "Could not reach the ATP extraction service. Please check your connection and try again.",
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setExtracting(false);
    }
  }

  function applyExtraction() {
    if (!extraction) {
      return;
    }

    if (!hasUsefulExtraction(extraction)) {
      setError(
        "No reliable ATP fields were extracted. Try another photo or encode the ATP manually.",
      );

      return;
    }

    setError("");
    onApply(extraction);
    setApplied(true);
  }

  const busy = disabled || extracting || optimizing;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#d7c4a7] bg-white shadow-sm">
        <div className="border-b border-[#e9dfd0] bg-black px-5 py-5 sm:px-7">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b58a52] text-lg">
              ⌁
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#c6a66f]">
                AI Assisted Encoding
              </p>

              <h2 className="mt-1 text-xl font-black text-white">
                Scan BIR Form 1921 — Page 1
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d7d0c7]">
                Take a photo on mobile or upload a scanner image. AI will read
                the ATP information and prepare it for review. Always verify the
                extracted values before applying them to the form.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={busy}
              onChange={(event) => {
                void selectFile(event.target.files?.[0]);
              }}
              className="hidden"
            />

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                void selectFile(event.target.files?.[0]);
              }}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => {
                cameraInputRef.current?.click();
              }}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              📷 Take Photo
            </button>

            <button
              type="button"
              onClick={() => {
                uploadInputRef.current?.click();
              }}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-black bg-white px-5 text-sm font-black text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              📁 Upload Image
            </button>

            {file && (
              <button
                type="button"
                onClick={clearScan}
                disabled={busy}
                className="inline-flex h-12 items-center justify-center rounded-lg border border-[#d7c4a7] bg-[#fbf7ef] px-5 text-sm font-black text-[#6f6254] transition hover:bg-[#f3eadc] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Scan
              </button>
            )}
          </div>

          <p className="text-xs leading-5 text-[#7c6a56]">
            Supported: JPG, PNG, WEBP • Maximum 10 MB • Page 1 only. Phone
            photos are automatically optimized before AI extraction while the
            original image remains in the preview.
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {file && previewUrl && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-black">
                      Selected ATP Image
                    </p>

                    <p className="mt-1 truncate text-xs text-[#7c6a56]">
                      {file.name}
                    </p>
                  </div>

                  <p className="shrink-0 text-xs font-bold text-[#7c6a56]">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setImageViewerOpen(true);
                  }}
                  className="group relative mt-4 block w-full overflow-hidden rounded-lg border border-[#ded3c4] bg-white text-left outline-none transition hover:border-[#9b6b38] focus-visible:ring-2 focus-visible:ring-[#9b6b38]"
                  aria-label="Open ATP image viewer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="ATP Page 1 preview"
                    className="max-h-[520px] w-full object-contain transition duration-200 group-hover:brightness-[0.92]"
                  />

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                    <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-black shadow-lg">
                      🔍 Click to enlarge and verify
                    </span>
                  </div>
                </button>

                <div className="mt-4 rounded-lg border border-[#e3d8c7] bg-white px-3 py-2 text-xs leading-5 text-[#6f6254]">
                  {optimizing ? (
                    <span className="font-bold">
                      Preparing image for AI extraction…
                    </span>
                  ) : optimizedFile ? (
                    <>
                      Extraction upload: {formatFileSize(optimizedFile.size)}
                      {optimizedFile.size < file.size ? (
                        <span className="font-bold">
                          {" "}
                          • optimized for mobile
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "Image ready for extraction."
                  )}
                </div>

                <QRVerificationCard result={qrResult} />

                <button
                  type="button"
                  onClick={extractATP}
                  disabled={busy || !optimizedFile}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#8b5e34] px-5 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {optimizing
                    ? "Preparing Image..."
                    : extracting
                      ? "Reading ATP with AI..."
                      : extraction
                        ? "Scan ATP Again"
                        : "Scan ATP with AI"}
                </button>

                {extracting && (
                  <div className="mt-3 rounded-lg border border-[#e3d8c7] bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#d7c4a7] border-t-[#8b5e34]" />

                      <div>
                        <p className="text-xs font-black text-black">
                          Reading BIR Form 1921…
                        </p>

                        <p className="mt-1 text-[11px] leading-4 text-[#7c6a56]">
                          AI is extracting taxpayer, ATP and document
                          information.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#e3d8c7] bg-white p-4 sm:p-5">
                {!extraction ? (
                  <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed border-[#d7c4a7] bg-[#fffdf9] px-5 text-center">
                    <div>
                      <p className="text-sm font-black text-black">
                        Extraction preview will appear here
                      </p>

                      <p className="mt-2 text-xs leading-5 text-[#7c6a56]">
                        Nothing is written to the ATP form until you click Apply
                        to ATP Form.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ExtractionPreview
                    extraction={extraction}
                    applied={applied}
                    onApply={applyExtraction}
                    disabled={busy}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {imageViewerOpen && previewUrl && (
        <ATPImageViewer
          imageUrl={previewUrl}
          fileName={file?.name || "ATP Page 1"}
          onClose={() => {
            setImageViewerOpen(false);
          }}
        />
      )}
    </>
  );
}

function ATPImageViewer({
  imageUrl,
  fileName,
  onClose,
}: {
  imageUrl: string;
  fileName: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "+" || event.key === "=") {
        setZoom((current) => Math.min(4, current + 0.25));
      }

      if (event.key === "-") {
        setZoom((current) => Math.max(0.5, current - 0.25));
      }

      if (event.key === "0") {
        setZoom(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function zoomIn() {
    setZoom((current) => Math.min(4, current + 0.25));
  }

  function zoomOut() {
    setZoom((current) => Math.max(0.5, current - 0.25));
  }

  function resetZoom() {
    setZoom(1);

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    }
  }

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="ATP image verification"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/15 bg-black px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">
            ATP Image Verification
          </p>

          <p className="mt-0.5 max-w-[300px] truncate text-xs text-white/60 sm:max-w-[520px]">
            {fileName}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= 0.5}
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 text-lg font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Zoom out"
          >
            −
          </button>

          <div className="flex h-10 min-w-[76px] items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-black text-white">
            {zoomPercentage}%
          </div>

          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= 4}
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 text-lg font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Zoom in"
          >
            +
          </button>

          <button
            type="button"
            onClick={resetZoom}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 text-xs font-black text-white transition hover:bg-white/20"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-xs font-black text-black transition hover:bg-[#e7dac6]"
          >
            Close
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-auto bg-[#1c1c1c] p-4 sm:p-6"
      >
        <div
          className="mx-auto flex min-h-full items-start justify-center"
          style={{
            width: zoom > 1 ? `${zoom * 100}%` : "100%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Enlarged ATP Page 1 for verification"
            draggable={false}
            className="block h-auto select-none bg-white shadow-2xl"
            style={{
              width: zoom <= 1 ? `${zoom * 100}%` : "100%",
              maxWidth: zoom <= 1 ? "1200px" : "none",
            }}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-white/15 bg-black px-4 py-2 text-center text-[11px] text-white/60">
        Use + and − to zoom • Reset returns to 100% • Press Esc to close
      </div>
    </div>
  );
}

function ExtractionPreview({
  extraction,
  applied,
  onApply,
  disabled,
}: {
  extraction: ATPExtraction;
  applied: boolean;
  onApply: () => void;
  disabled: boolean;
}) {
  const fields = [
    ["Date of ATP", extraction.dateOfAtp],
    ["OCN", extraction.ocn],
    ["TIN", extraction.tin],
    ["Taxpayer Name", extraction.taxpayerName],
    ["Business Name", extraction.businessName],
    ["RDO Code", extraction.rdoCode],
    ["Tax Type", extraction.taxType],
    ["Registered Address", extraction.registeredAddress],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-black">Extracted ATP Data</p>

          <p className="mt-1 text-xs text-[#7c6a56]">
            Review all values before applying.
          </p>

          <p className="mt-1 text-[11px] font-bold text-[#8b5e34]">
            Source: AI Extraction
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${confidenceClassName(
            extraction.overallConfidence,
          )}`}
        >
          {extraction.overallConfidence} confidence
        </span>
      </div>

      <div className="mt-4 divide-y divide-[#eee5d8] rounded-lg border border-[#e3d8c7]">
        {fields.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr] sm:gap-4"
          >
            <p className="text-xs font-black text-[#6f6254]">{label}</p>

            <p
              className={`text-sm font-semibold ${
                value ? "text-black" : "text-amber-700"
              }`}
            >
              {value || "Not confidently read"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7c6a56]">
          Documents
        </p>

        {extraction.documents.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            No document row was confidently extracted. Enter it manually.
          </div>
        ) : (
          extraction.documents.map((document, index) => (
            <div
              key={`${document.description}-${index}`}
              className="rounded-lg border border-[#e3d8c7] bg-[#fbf7ef] p-4 text-sm"
            >
              <p className="font-black text-black">
                Document #{index + 1}: {document.description || "Unknown"}
              </p>

              <p className="mt-2 leading-6 text-[#6f6254]">
                Manner: {document.manner || "—"} • Booklets:{" "}
                {document.booklets || "—"} • Sets/Booklet:{" "}
                {document.setsPerBooklet || "—"} • Copies/Set:{" "}
                {document.copiesPerSet === "OTHER"
                  ? document.copiesPerSetOther || "OTHER"
                  : document.copiesPerSet || "—"}
              </p>

              <p className="mt-1 font-mono text-xs text-[#6f6254]">
                Serial: {document.serialNumbers || "—"}
              </p>
            </div>
          ))
        )}
      </div>

      {extraction.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-800">
            Check these fields
          </p>

          <ul className="mt-2 space-y-1 pl-5 text-xs leading-5 text-amber-800">
            {extraction.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`} className="list-disc">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onApply}
        disabled={disabled || !hasUsefulExtraction(extraction)}
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {applied ? "Applied — Review Form Below" : "Apply to ATP Form"}
      </button>

      {applied && (
        <p className="mt-2 text-center text-xs font-semibold text-emerald-700">
          Extraction applied. Review the form below before submitting.
        </p>
      )}
    </div>
  );
}

function QRVerificationCard({ result }: { result: QRScanResult }) {
  if (result.status === "idle") {
    return null;
  }

  const tone =
    result.status === "detected" && result.officialBir
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : result.status === "detected"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : result.status === "scanning"
          ? "border-[#e3d8c7] bg-white text-[#6f6254]"
          : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div
      className={`mt-3 rounded-lg border px-3 py-3 text-xs leading-5 ${tone}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-black uppercase tracking-[0.1em]">ATP QR Check</p>

        {result.status === "detected" && result.officialBir ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-black text-emerald-800">
            Official BIR destination
          </span>
        ) : null}
      </div>

      <p className="mt-1 font-semibold">{result.message}</p>

      {result.status === "detected" && result.rawValue ? (
        <div className="mt-2 rounded-md border border-current/15 bg-white/70 px-2 py-2">
          <p className="font-black">Decoded QR</p>

          <p className="mt-1 break-all font-mono text-[11px]">
            {result.rawValue}
          </p>
        </div>
      ) : null}

      {result.url && result.officialBir ? (
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex font-black underline underline-offset-2"
        >
          Open official BIR verification ↗
        </a>
      ) : null}

      {result.status === "detected" && !result.officialBir ? (
        <p className="mt-2 font-semibold">
          QR was decoded, but it is not an official bir.gov.ph URL. Do not use
          it as proof that the ATP is valid.
        </p>
      ) : null}

      {result.status === "detected" && result.officialBir ? (
        <p className="mt-2">
          This confirms only that the QR points to an official BIR domain. Final
          ATP validity still depends on the result shown by BIR.
        </p>
      ) : null}
    </div>
  );
}

async function decodeATPQRCode(file: File): Promise<QRScanResult> {
  try {
    const image = await loadImage(file);

    const largestSide = Math.max(image.width, image.height);

    const scale = Math.min(1, QR_MAX_DIMENSION / largestSide);

    const width = Math.max(1, Math.round(image.width * scale));

    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      image.cleanup();

      return {
        ...EMPTY_QR_RESULT,
        status: "error",
        message: "QR reader is not available in this browser.",
      };
    }

    context.drawImage(image.element, 0, 0, width, height);

    image.cleanup();

    const regions = [
      {
        x: Math.floor(width * 0.45),
        y: 0,
        w: Math.ceil(width * 0.55),
        h: Math.ceil(height * 0.5),
      },
      {
        x: 0,
        y: 0,
        w: width,
        h: height,
      },
    ];

    for (const region of regions) {
      const data = context.getImageData(region.x, region.y, region.w, region.h);

      const qr = jsQR(data.data, data.width, data.height, {
        inversionAttempts: "attemptBoth",
      });

      if (!qr?.data) {
        continue;
      }

      const rawValue = qr.data.trim();

      const url = normalizeHttpUrl(rawValue);

      const officialBir = url ? isOfficialBirUrl(url) : false;

      return {
        status: "detected",
        rawValue,
        url,
        officialBir,
        message: officialBir
          ? "QR detected and it points to an official BIR domain."
          : url
            ? "QR detected, but its destination is not an official bir.gov.ph domain."
            : "QR detected. The encoded value is not a web address, so review it manually.",
      };
    }

    return {
      ...EMPTY_QR_RESULT,
      status: "not-found",
      message:
        "No readable QR code was found. Retake the photo with the QR sharp and fully visible.",
    };
  } catch (qrError) {
    console.error("ATP QR decode failed:", qrError);

    return {
      ...EMPTY_QR_RESULT,
      status: "error",
      message:
        "The QR code could not be read. AI extraction can still continue normally.",
    };
  }
}

function normalizeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function isOfficialBirUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return hostname === "bir.gov.ph" || hostname.endsWith(".bir.gov.ph");
  } catch {
    return false;
  }
}

function confidenceClassName(confidence: ATPExtraction["overallConfidence"]) {
  if (confidence === "high") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (confidence === "medium") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-red-100 text-red-800";
}

function hasUsefulExtraction(extraction: ATPExtraction) {
  return Boolean(
    extraction.dateOfAtp ||
    extraction.ocn ||
    extraction.tin ||
    extraction.taxpayerName ||
    extraction.businessName ||
    extraction.registeredAddress ||
    extraction.rdoCode ||
    extraction.taxType ||
    extraction.documents.some((document) =>
      Object.values(document).some((value) => value.trim()),
    ),
  );
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as {
      error?: unknown;
      extraction?: unknown;
    };
  } catch {
    return null;
  }
}

async function prepareImageForExtraction(source: File): Promise<File> {
  if (typeof document === "undefined") {
    return source;
  }

  const image = await loadImage(source);

  const largestSide = Math.max(image.width, image.height);

  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / largestSide);

  const width = Math.max(1, Math.round(image.width * scale));

  const height = Math.max(1, Math.round(image.height * scale));

  if (scale === 1 && source.size <= TARGET_UPLOAD_SIZE) {
    image.cleanup();
    return source;
  }

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    alpha: false,
  });

  if (!context) {
    image.cleanup();
    return source;
  }

  context.fillStyle = "#ffffff";

  context.fillRect(0, 0, width, height);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(image.element, 0, 0, width, height);

  image.cleanup();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  if (!blob) {
    return source;
  }

  if (blob.size >= source.size && scale === 1) {
    return source;
  }

  return new File([blob], replaceExtension(source.name, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function loadImage(file: File): Promise<{
  element: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    return {
      element: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => {
        bitmap.close();
      },
    };
  }

  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();

      nextImage.onload = () => {
        resolve(nextImage);
      };

      nextImage.onerror = () => {
        reject(new Error("Could not read image."));
      };

      nextImage.src = url;
    });

    return {
      element: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => {
        URL.revokeObjectURL(url);
      },
    };
  } catch (imageError) {
    URL.revokeObjectURL(url);
    throw imageError;
  }
}

function replaceExtension(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, "") || "atp-page-1";

  return `${baseName}${extension}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
