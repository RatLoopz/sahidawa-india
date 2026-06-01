'use client';

import React, { ReactNode } from 'react';
import { AlertTriangle, Wifi, Home } from 'lucide-react';

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
      error.message.includes('fetch') ||
      error.message.includes('offline') ||
      error.message.includes('network') ||
      error.name === 'TypeError';

    return {
      hasError: true,
      isOfflineError,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('OfflineErrorBoundary caught error:', error, info);
  }

  handleRetry = () => {
    this.setState({ isChecking: true });

    if (typeof window !== 'undefined' && !navigator.onLine) {
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
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
              {this.state.isOfflineError ? (
                <Wifi size={32} className="text-amber-600 dark:text-amber-400" />
              ) : (
                <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {this.state.isOfflineError ? 'Connection Lost' : 'Something Went Wrong'}
            </h2>

            <p aria-live="polite" className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              {this.state.isOfflineError
                ? 'Please check your internet connection and try again. Cached data may still be available.'
                : 'An unexpected error occurred. Please try again or go back.'}
            </p>

            <div className="flex gap-3 flex-col sm:flex-row">
              <button
                type="button"
                onClick={this.handleRetry}
                disabled={this.state.isChecking}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {this.state.isChecking ? 'Checking...' : 'Try Again'}
              </button>

              <a
                href="/"
                className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors text-center"
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
