"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "./compressImage";

export type UploadState =
    | { status: "idle" }
    | { status: "uploading"; progress: number }
    | { status: "success"; secureUrl: string }
    | { status: "error"; message: string };

export interface UseUploadReturn {
    state: UploadState;
    upload: (file: File) => Promise<void>;
    reset: () => void;
    cancel: () => void;
}

export function useUpload(onUploadComplete: (url: string) => void): UseUploadReturn {
    const [state, setState] = useState<UploadState>({ status: "idle" });
    const stateRef = useRef(state);
    const xhrRef = useRef<XMLHttpRequest | null>(null);
    const cancelledRef = useRef(false);

    stateRef.current = state;

    const abortActiveRequest = useCallback(() => {
        cancelledRef.current = true;
        xhrRef.current?.abort();
        xhrRef.current = null;
    }, []);

    const reset = useCallback(() => {
        abortActiveRequest();
        setState({ status: "idle" });
    }, [abortActiveRequest]);

    const cancel = useCallback(() => {
        abortActiveRequest();
        setState({ status: "idle" });
    }, [abortActiveRequest]);

    const upload = useCallback(
        async (file: File) => {
            if (stateRef.current.status !== "idle") {
                return;
            }

            cancelledRef.current = false;
            setState({ status: "uploading", progress: 0 });

            const compressed = await compressImage(file);

            const formData = new FormData();
            formData.append("file", compressed);

            try {
                const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhrRef.current = xhr;

                    xhr.upload.addEventListener("progress", (event) => {
                        if (event.lengthComputable) {
                            const pct = Math.round((event.loaded / event.total) * 100);
                            setState({ status: "uploading", progress: pct });
                        }
                    });

                    xhr.open("POST", "/api/upload");

                    xhr.onload = () => {
                        xhrRef.current = null;
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                resolve(JSON.parse(xhr.responseText) as { secure_url: string });
                            } catch {
                                reject(new Error("Upload failed"));
                            }
                            return;
                        }

                        try {
                            const body = JSON.parse(xhr.responseText) as { error?: string };
                            reject(new Error(body.error || "Upload failed"));
                        } catch {
                            reject(new Error("Upload failed"));
                        }
                    };

                    xhr.onerror = () => {
                        xhrRef.current = null;
                        reject(new Error("Network error during upload"));
                    };

                    xhr.onabort = () => {
                        xhrRef.current = null;
                        reject(new Error("Upload cancelled"));
                    };

                    xhr.send(formData);
                });

                if (cancelledRef.current) {
                    return;
                }

                setState({ status: "success", secureUrl: result.secure_url });
                onUploadComplete(result.secure_url);
            } catch (error) {
                if (cancelledRef.current) {
                    return;
                }

                const message = error instanceof Error ? error.message : "Upload failed";

                if (message === "Upload cancelled") {
                    return;
                }

                setState({ status: "error", message });
            }
        },
        [onUploadComplete]
    );

    useEffect(() => {
        return () => {
            xhrRef.current?.abort();
            xhrRef.current = null;
        };
    }, []);

    return { state, upload, reset, cancel };
}
