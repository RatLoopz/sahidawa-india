"use client";

import React, { useState } from "react";

interface UploadResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ row: number; reason: string }>;
}

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "text/csv") {
      setFile(droppedFile);
      setApiError(null);
    } else {
      setApiError("Please drop a valid CSV file.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setApiError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setApiError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const textContent = e.target?.result;
      if (typeof textContent !== "string") {
        setApiError("Failed to parse file content reading framework.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/pharmacies/bulk-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileContent: textContent }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Something went wrong during data ingestion.",
          );
        }

        setResult(data);
      } catch (err: any) {
        setApiError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Bulk Medicine Upload
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload up to 500 medicine line items to your inventory using a
          structured CSV file.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          type="file"
          accept=".csv"
          id="csv-upload-input"
          className="hidden"
          onChange={handleFileChange}
        />
        <label
          htmlFor="csv-upload-input"
          className="cursor-pointer block space-y-2"
        >
          <div className="text-gray-600 font-medium">
            {file
              ? `Selected file: ${file.name}`
              : "Drag and drop your CSV inventory file here"}
          </div>
          <div className="text-xs text-gray-400">
            or click to browse your local device files
          </div>
        </label>
      </div>

      {/* Control Actions */}
      <div className="flex items-center justify-end gap-3">
        {file && (
          <button
            onClick={() => setFile(null)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isLoading}
          >
            Clear File
          </button>
        )}
        <button
          onClick={handleUpload}
          disabled={!file || isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? "Processing Rows..." : "Process Bulk Upload"}
        </button>
      </div>

      {/* Error Output Panels */}
      {apiError && (
        <div className="p-4 rounded-md bg-red-50 text-sm text-red-700 font-medium border border-red-200">
          ⚠️ {apiError}
        </div>
      )}

      {/* Log Output Result Summary Cards */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-900">
              Upload Processing Execution Summary
            </h3>
          </div>
          <div className="p-5 grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 p-3 rounded border">
              <div className="text-xl font-bold text-gray-700">
                {result.totalRows}
              </div>
              <div className="text-xs text-gray-500 font-medium uppercase mt-1">
                Total Parsed Rows
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded border border-green-100">
              <div className="text-xl font-bold text-green-700">
                {result.successCount}
              </div>
              <div className="text-xs text-green-600 font-medium uppercase mt-1">
                Successfully Saved
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded border border-red-100">
              <div className="text-xl font-bold text-red-700">
                {result.failedCount}
              </div>
              <div className="text-xs text-red-600 font-medium uppercase mt-1">
                Validation Failures
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="p-5 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Item Failure Log Rows:
              </h4>
              <div className="max-h-48 overflow-y-auto bg-gray-900 text-gray-100 font-mono text-xs rounded p-3 space-y-1.5">
                {result.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="border-b border-gray-800 pb-1 last:border-0 last:pb-0"
                  >
                    <span className="text-amber-400">[Line Row {err.row}]</span>{" "}
                    : {err.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
