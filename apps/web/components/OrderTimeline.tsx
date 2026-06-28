'use client';

/**
 * OrderTimeline Component
 * Displays order status timeline with buyer-friendly visualization
 * Fixes issue #2735: Buyers now have visibility into order progress
 */

import React from 'react';
import { formatDate } from '@/lib/utils';

export interface TimelineStep {
    status: string;
    label: string;
    completed: boolean;
    timestamp?: string;
}

interface OrderTimelineProps {
    timeline: TimelineStep[];
    currentStatus?: string;
}

const STATUS_COLORS: Record<string, string> = {
    placed: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-amber-100 text-amber-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const STEP_ICONS: Record<string, string> = {
    placed: '📦',
    confirmed: '✓',
    shipped: '🚚',
    delivered: '🎉',
    cancelled: '❌',
};

/**
 * OrderTimeline component showing four-stage order lifecycle
 *
 * Stages:
 * 1. Placed - Order created by buyer
 * 2. Confirmed - Seller confirmed they can fulfill
 * 3. Shipped - Items sent to buyer with tracking
 * 4. Delivered - Buyer received order
 *
 * Visual features:
 * - Completed steps show in primary color
 * - Current step highlighted
 * - Pending steps muted
 * - Timestamps shown when available
 * - Support for cancelled orders
 */
export default function OrderTimeline({
    timeline,
    currentStatus,
}: OrderTimelineProps) {
    if (!timeline || timeline.length === 0) {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-gray-600">No timeline data available</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Timeline Container */}
            <div className="space-y-4">
                {timeline.map((step, index) => (
                    <div key={step.status} className="flex items-start gap-4">
                        {/* Timeline Node */}
                        <div className="flex flex-col items-center">
                            {/* Circle */}
                            <div
                                className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                                    step.completed
                                        ? 'scale-100 bg-green-100 text-green-800'
                                        : currentStatus === step.status
                                          ? 'scale-110 animate-pulse border-2 border-blue-500 bg-blue-50 text-blue-800'
                                          : 'bg-gray-100 text-gray-400'
                                }`}
                            >
                                <span className="text-lg">
                                    {step.completed
                                        ? '✓'
                                        : currentStatus === step.status
                                          ? '⏳'
                                          : STEP_ICONS[step.status] || '○'}
                                </span>
                            </div>

                            {/* Connector Line */}
                            {index < timeline.length - 1 && (
                                <div
                                    className={`h-12 w-1 transition-all ${
                                        step.completed
                                            ? 'bg-green-300'
                                            : 'bg-gray-200'
                                    }`}
                                />
                            )}
                        </div>

                        {/* Timeline Step Content */}
                        <div className="flex-1 pt-1">
                            <div
                                className={`rounded-lg border p-4 transition-all ${
                                    step.completed
                                        ? 'border-green-200 bg-green-50'
                                        : currentStatus === step.status
                                          ? 'border-blue-300 bg-blue-50'
                                          : 'border-gray-200 bg-gray-50'
                                }`}
                            >
                                {/* Title */}
                                <h3
                                    className={`font-semibold ${
                                        step.completed
                                            ? 'text-green-900'
                                            : currentStatus === step.status
                                              ? 'text-blue-900'
                                              : 'text-gray-600'
                                    }`}
                                >
                                    {step.label}
                                </h3>

                                {/* Status Badge */}
                                <span
                                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                                        STATUS_COLORS[step.status] ||
                                        'bg-gray-200 text-gray-800'
                                    }`}
                                >
                                    {step.status}
                                </span>

                                {/* Timestamp */}
                                {step.timestamp && (
                                    <p className="mt-2 text-xs text-gray-600">
                                        <time dateTime={step.timestamp}>
                                            {formatDate(new Date(step.timestamp))}
                                        </time>
                                    </p>
                                )}

                                {/* Status Messages */}
                                {step.completed && currentStatus !== step.status && (
                                    <p className="mt-2 text-xs text-green-700">
                                        ✓ Completed
                                    </p>
                                )}

                                {currentStatus === step.status && (
                                    <p className="mt-2 text-xs text-blue-700">
                                        ⏳ In progress...
                                    </p>
                                )}

                                {!step.completed &&
                                    currentStatus !== step.status && (
                                        <p className="mt-2 text-xs text-gray-600">
                                            Pending
                                        </p>
                                    )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Help Text */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
                <p className="text-gray-700">
                    <strong>📌 Order Status:</strong> Your order progresses through
                    these stages. We'll notify you when each step is complete.
                </p>
            </div>
        </div>
    );
}

/**
 * Order Timeline Step Summary (compact version)
 */
export function OrderTimelineCompact({ timeline }: { timeline: TimelineStep[] }) {
    const completedCount = timeline.filter((s) => s.completed).length;
    const progressPercent = Math.round(
        (completedCount / timeline.length) * 100
    );

    return (
        <div className="space-y-2">
            {/* Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Progress Text */}
            <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-600">{completedCount} of {timeline.length} steps complete</span>
                <span className="text-gray-900">{progressPercent}%</span>
            </div>

            {/* Status Dots */}
            <div className="flex gap-2">
                {timeline.map((step) => (
                    <div
                        key={step.status}
                        className={`h-2 w-2 rounded-full transition-all ${
                            step.completed
                                ? 'bg-green-500'
                                : 'bg-gray-300'
                        }`}
                        title={step.label}
                    />
                ))}
            </div>
        </div>
    );
}
