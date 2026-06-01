"use client";

import React, { ReactNode } from "react";
import { AlertTriangle, Wifi, Home } from "lucide-react";

interface OfflineErrorBoundaryProps {
    children: ReactNode;
}

interface OfflineErrorBoundaryState {
    hasError: boolean;
    isOfflineError: boolean;
    isChecking: boolean;
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
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[400px] items-center justify-center p-4">
                    <div className="max-w-md text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
                            {this.state.isOfflineError ? (
                                <Wifi size={32} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                                <AlertTriangle
                                    size={32}
                                    className="text-red-600 dark:text-red-400"
                                />
                            )}
                        </div>

                        <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                            {this.state.isOfflineError ? "Connection Lost" : "Something Went Wrong"}
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
                                href="/"
                                className="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-center font-semibold text-slate-900 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                            >
                                Go Home
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
