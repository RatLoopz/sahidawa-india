"use client";

import React, { ReactNode } from "react";
import { AlertTriangle, Wifi } from "lucide-react";

interface OfflineErrorBoundaryProps {
    children: ReactNode;
}

interface OfflineErrorBoundaryState {
    hasError: boolean;
    isOfflineError: boolean;
    isChecking: boolean;
    errorStack?: string;
    componentStack?: string;
}

/**
 * Error boundary specifically for offline/network errors
 * Provides graceful fallback UI instead of crashing the app
 */
export class OfflineErrorBoundary extends React.Component<
    OfflineErrorBoundaryProps,
    OfflineErrorBoundaryState
> {
    constructor(props: OfflineErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            isOfflineError: false,
            isChecking: false,
            errorStack: "",
            componentStack: "",
        };
    }

    static getDerivedStateFromError(error: Error) {
        const isOfflineError =
            error.message.includes("fetch") ||
            error.message.includes("offline") ||
            error.message.includes("network") ||
            error.name === "TypeError";

        return {
            hasError: true,
            isOfflineError,
        };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("OfflineErrorBoundary caught error:", error, info);

        if (process.env.NODE_ENV === "development") {
            console.group("🔴 OfflineErrorBoundary Dev Trace");
            console.error("Error:", error);
            console.error("Stack:", error.stack);
            console.error("Component Stack:", info.componentStack);
            console.groupEnd();

            this.setState({
                errorStack: error.stack || "",
                componentStack: info.componentStack || "",
            });
        }
    }

    handleRetry = () => {
        this.setState({ isChecking: true });

        if (typeof window !== "undefined" && !navigator.onLine) {
            setTimeout(() => {
                this.setState({ isChecking: false });
            }, 1000);
            return;
        }

        this.setState({
            hasError: false,
            isOfflineError: false,
            isChecking: false,
        });
    };

    render() {
        const homeHref =
            typeof window !== "undefined"
                ? `/${window.location.pathname.split("/")[1] || "en"}`
                : "/";
        if (this.state.hasError) {
            return (
                <>
                    <div className="flex min-h-[400px] items-center justify-center p-4">
                        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50 dark:bg-amber-900/20 dark:ring-amber-900/10">
                                {this.state.isOfflineError ? (
                                    <Wifi
                                        size={32}
                                        className="text-amber-600 dark:text-amber-400"
                                    />
                                ) : (
                                    <AlertTriangle
                                        size={32}
                                        className="text-red-600 dark:text-red-400"
                                    />
                                )}
                            </div>

                            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                                {this.state.isOfflineError
                                    ? "Connection Lost"
                                    : "Something Went Wrong"}
                            </h2>

                            <p
                                aria-live="polite"
                                className="mb-6 text-sm text-slate-600 dark:text-slate-400"
                            >
                                {this.state.isOfflineError
                                    ? "Please check your internet connection and try again. Cached data may still be available."
                                    : "An unexpected error occurred. Please try again or go back."}
                            </p>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={this.handleRetry}
                                    disabled={this.state.isChecking}
                                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {this.state.isChecking ? "Checking..." : "Try Again"}
                                </button>

                                <a
                                    href={homeHref}
                                    className="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-center font-semibold text-slate-900 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                                >
                                    Go Home
                                </a>
                            </div>
                        </div>
                    </div>

                    {process.env.NODE_ENV === "development" && this.state.componentStack && (
                        <details className="mt-6 text-left">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Developer Error Details
                            </summary>

                            <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-3 text-xs dark:bg-slate-800">
                                {this.state.componentStack}
                            </pre>
                        </details>
                    )}
                </>
            );
        }

        return this.props.children;
    }
}
