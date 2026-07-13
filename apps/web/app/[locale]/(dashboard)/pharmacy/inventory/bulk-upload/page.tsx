"use client";

import React, { useState } from "react";
import { API_BASE } from "@/lib/api";
import { useSession } from "@/src/components/AuthProvider";
import { MAX_BULK_UPLOAD_ITEMS, MAX_BULK_UPLOAD_FILE_SIZE_BYTES } from "@sahidawa/shared";

interface UploadResult {
    totalRows: number;
    successCount: number;
    failedCount: number;
    errors: Array<{ row: number; reason: string }>;
}

export default function BulkUploadPage() {
    const { token } = useSession();
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [progressStats, setProgressStats] = useState<{
        processed: number;
        total: number;
        errors: number;
    } | null>(null);

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
            if (droppedFile.size > MAX_BULK_UPLOAD_FILE_SIZE_BYTES) {
                setApiError(
                    `File exceeds the maximum limit of ${
                        MAX_BULK_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024)
                    }MB.`
                );
                return;
            }

            setFile(droppedFile);
            setApiError(null);
        } else {
            setApiError("Please drop a valid CSV file.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];

        if (selectedFile) {
            if (selectedFile.size > MAX_BULK_UPLOAD_FILE_SIZE_BYTES) {
                setApiError(
                    `File exceeds the maximum limit of ${
                        MAX_BULK_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024)
                    }MB.`
                );
                return;
            }

            setFile(selectedFile);
            setApiError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsLoading(true);
        setApiError(null);
        setResult(null);
        setProgressStats({ processed: 0, total: 0, errors: 0 });

        const reader = new FileReader();
        reader.onload = async (e) => {
            const textContent = e.target?.result;
            if (typeof textContent !== "string") {
                setApiError("Failed to parse file content reading framework.");
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/pharmacies/bulk-upload`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ fileContent: textContent }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Something went wrong during data ingestion.");
                }

                const streamReader = response.body?.getReader();
                if (!streamReader) {
                    throw new Error("Response body is not readable.");
                }

                const decoder = new TextDecoder();
                let doneReading = false;
                let buffer = "";

                while (!doneReading) {
                    const { done, value } = await streamReader.read();
                    if (done) {
                        doneReading = true;
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const dataStr = line.substring(6);
                            try {
                                const data = JSON.parse(dataStr);
                                if (data.error) {
                                    throw new Error(data.error);
                                }
                                if (data.done) {
                                    setResult({
                                        totalRows: data.totalRows,
                                        successCount: data.successCount,
                                        failedCount: data.failedCount,
                                        errors: data.errors,
                                    });
                                } else if (data.processed !== undefined) {
                                    setProgressStats({
                                        processed: data.processed,
                                        total: data.total,
                                        errors: data.errors,
                                    });
                                }
                            } catch (parseErr: any) {
                                if (
                                    parseErr.message !== "Unexpected end of JSON input" &&
                                    !parseErr.message.includes("JSON")
                                ) {
                                    throw parseErr;
                                }
                            }
                        }
                    }
                }
            } catch (err: any) {
                setApiError(err.message || "An unexpected error occurred.");
            } finally {
                setIsLoading(false);
                setProgressStats(null);
            }
        };

        reader.readAsText(file);
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    Bulk Medicine Upload
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Upload up to {MAX_BULK_UPLOAD_ITEMS} medicine line items to your inventory using
                    a structured CSV file.
                </p>
            </div>

            {/* Drag & Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
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
                <label htmlFor="csv-upload-input" className="block cursor-pointer space-y-2">
                    <div className="font-medium text-gray-600">
                        {file
                            ? `Selected file: ${file.name}`
                            : "Drag and drop your CSV inventory file here"}
                    </div>
                    <div className="text-xs text-gray-400">
                        or click to browse your local device files
                    </div>
                </label>
            </div>

            {/* Progress Bar */}
            {isLoading && progressStats && (
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                        Processing Upload...
                    </h3>
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                            Processed {progressStats.processed} / {progressStats.total} rows
                        </span>
                        {progressStats.errors > 0 && (
                            <span className="font-medium text-red-600">
                                {progressStats.errors} errors
                            </span>
                        )}
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                            className="h-2.5 rounded-full bg-emerald-600 transition-all duration-300"
                            style={{
                                width: `${progressStats.total > 0 ? Math.min(100, (progressStats.processed / progressStats.total) * 100) : 0}%`,
                            }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Control Actions */}
            <div className="flex items-center justify-end gap-3">
                {file && (
                    <button
                        onClick={() => setFile(null)}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        disabled={isLoading}
                    >
                        Clear File
                    </button>
                )}
                <button
                    onClick={handleUpload}
                    disabled={!file || isLoading}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading ? "Processing Rows..." : "Process Bulk Upload"}
                </button>
            </div>

            {/* Error Output Panels */}
            {apiError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                    ⚠️ {apiError}
                </div>
            )}

            {/* Log Output Result Summary Cards */}
            {result && (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 bg-gray-50 p-5">
                        <h3 className="font-semibold text-gray-900">
                            Upload Processing Execution Summary
                        </h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-5 text-center">
                        <div className="rounded border bg-gray-50 p-3">
                            <div className="text-xl font-bold text-gray-700">
                                {result.totalRows}
                            </div>
                            <div className="mt-1 text-xs font-medium text-gray-500 uppercase">
                                Total Parsed Rows
                            </div>
                        </div>
                        <div className="rounded border border-green-100 bg-green-50 p-3">
                            <div className="text-xl font-bold text-green-700">
                                {result.successCount}
                            </div>
                            <div className="mt-1 text-xs font-medium text-green-600 uppercase">
                                Successfully Saved
                            </div>
                        </div>
                        <div className="rounded border border-red-100 bg-red-50 p-3">
                            <div className="text-xl font-bold text-red-700">
                                {result.failedCount}
                            </div>
                            <div className="mt-1 text-xs font-medium text-red-600 uppercase">
                                Validation Failures
                            </div>
                        </div>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="border-t border-gray-100 p-5">
                            <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                Item Failure Log Rows:
                            </h4>
                            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded bg-gray-900 p-3 font-mono text-xs text-gray-100">
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
