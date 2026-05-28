"use client";

import { useState, useRef } from "react";

export default function MedicinePhotoUpload() {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

  
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        setUploadedUrl(data.secure_url);
        setProgress(100);
      } else {
        setError("Upload failed. Please try again.");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("Upload failed. Please try again.");
    };

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 border rounded-xl w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold">Upload Medicine Photo</h2>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="medicine-upload"
      />

      <label
        htmlFor="medicine-upload"
        className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Choose Photo
      </label>

      {preview && (
        <img
          src={preview}
          alt="Medicine preview"
          className="w-full max-h-64 object-contain rounded-lg border"
        />
      )}

      {preview && !uploadedUrl && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
        >
          {uploading ? "Uploading..." : "Upload Photo"}
        </button>
      )}

      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <p className="text-sm text-center mt-1">{progress}%</p>
        </div>
      )}

      {uploadedUrl && (
        <p className="text-green-600 font-medium text-sm text-center">
          ✅ Upload successful!
        </p>
      )}

      {error && (
        <p className="text-red-500 text-sm text-center">{error}</p>
      )}
    </div>
  );
}