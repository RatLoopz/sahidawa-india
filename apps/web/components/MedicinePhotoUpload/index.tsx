"use client";

import { useRef, useState, useCallback } from "react";

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface MedicinePhotoUploadProps {
  onUploadSuccess: (cloudinaryUrl: string) => void;
  onUploadError?: (error: string) => void;
}

type UploadState = "idle" | "validating" | "uploading" | "success" | "error";

export default function MedicinePhotoUpload({
  onUploadSuccess,
  onUploadError,
}: MedicinePhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);

  const resetState = () => {
    setUploadState("idle");
    setProgress(0);
    setPreviewUrl(null);
    setErrorMessage(null);
    setCloudinaryUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleError = useCallback(
    (message: string) => {
      setUploadState("error");
      setErrorMessage(message);
      onUploadError?.(message);
    },
    [onUploadError]
  );

  const uploadToCloudinary = useCallback(
    async (file: File) => {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        handleError("Cloudinary is not configured. Check your .env.local file.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", "sahidawa/medicines");

      setUploadState("uploading");
      setProgress(0);

      try {
        // Use XMLHttpRequest so we can track upload progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText);
              setCloudinaryUrl(data.secure_url);
              setUploadState("success");
              onUploadSuccess(data.secure_url);
              resolve();
            } else {
              reject(new Error("Upload failed — server returned " + xhr.status));
            }
          });

          xhr.addEventListener("error", () =>
            reject(new Error("Network error during upload."))
          );

          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
          );
          xhr.send(formData);
        });
      } catch (err: unknown) {
        handleError(
          err instanceof Error ? err.message : "Upload failed. Please try again."
        );
      }
    },
    [onUploadSuccess, handleError]
  );

  const handleFileChange = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      setUploadState("validating");
      setErrorMessage(null);
      setPreviewUrl(null);

      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        handleError("Invalid file type. Please upload a JPG, PNG, or WebP image.");
        return;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        handleError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      // Show local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      await uploadToCloudinary(file);
    },
    [handleError, uploadToCloudinary]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const isUploading = uploadState === "uploading" || uploadState === "validating";

  return (
    <div className="w-full max-w-md mx-auto font-sans">
      {/* Drop zone / trigger area */}
      {uploadState !== "success" && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-3
            rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer
            ${isUploading
              ? "border-blue-300 bg-blue-50 cursor-not-allowed"
              : uploadState === "error"
              ? "border-red-300 bg-red-50 hover:bg-red-100"
              : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-400"
            }
          `}
        >
          {/* Camera icon */}
          <div className="text-4xl select-none">
            {isUploading ? "⏳" : uploadState === "error" ? "⚠️" : "📷"}
          </div>

          {isUploading ? (
            <p className="text-sm text-blue-700 font-medium">
              {uploadState === "validating" ? "Checking file…" : `Uploading… ${progress}%`}
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700">
                Tap to photograph or upload medicine packaging
              </p>
              <p className="text-xs text-gray-500">
                JPG, PNG, or WebP — max {MAX_FILE_SIZE_MB}MB
              </p>
            </>
          )}

          {/* Hidden file input — accepts camera on mobile */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handleInputChange}
            disabled={isUploading}
            aria-label="Upload medicine photo"
          />
        </div>
      )}

      {/* Progress bar */}
      {uploadState === "uploading" && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 bg-blue-500 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {/* Preview + success */}
      {previewUrl && (
        <div className="mt-4">
          <img
            src={previewUrl}
            alt="Medicine packaging preview"
            className="w-full rounded-xl object-cover max-h-64 border border-gray-200 shadow-sm"
          />

          {uploadState === "success" && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm font-medium">
                <span>✅</span>
                <span>Photo uploaded successfully</span>
              </div>

              {cloudinaryUrl && (
                <p className="text-xs text-gray-400 break-all px-1">
                  {cloudinaryUrl}
                </p>
              )}

              <button
                onClick={resetState}
                className="mt-1 text-sm text-blue-600 underline hover:text-blue-800 text-left"
              >
                Upload a different photo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {uploadState === "error" && errorMessage && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span className="mt-0.5">❌</span>
          <div className="flex-1">
            <p className="font-medium">{errorMessage}</p>
            <button
              onClick={resetState}
              className="mt-1 text-red-600 underline hover:text-red-800 text-xs"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}