import { useState, useCallback, useRef, useEffect } from "react";
import { checkLasaConflicts, type LasaCheckResult } from "@/lib/api";

export function useLASAChecker() {
    const [data, setData] = useState<LasaCheckResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const checkLasa = useCallback(async (medicineName: string) => {
        const query = medicineName.trim();
        if (query.length < 2) {
            setData(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        // Cancel previous pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const result = await checkLasaConflicts(query, controller.signal);
            setData(result);
        } catch (err: any) {
            if (err.name === "AbortError") {
                return;
            }
            console.error("useLASAChecker error:", err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        data,
        isLoading,
        error,
        checkLasa,
    };
}
