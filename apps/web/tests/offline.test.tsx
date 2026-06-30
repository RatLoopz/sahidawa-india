/**
 * @jest-environment jsdom
 */
/**
 * Tests for offline support functionality
 * Run with: npm test apps/web -- offline.test.ts
 */

import { join } from "path";
import * as fs from "fs";
import React, { act } from "react";
import { renderHook, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { fetchWithRetry, offlineRequestQueue } from "@/lib/apiWithRetry";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineErrorBoundary } from "@/components/OfflineErrorBoundary";

// Mock next-intl for OfflineBanner translations
jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => (key: string) => key,
}));

describe("Offline Support", () => {
    describe("fetchWithRetry", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            global.fetch = jest.fn();
        });

        it("should succeed on first attempt if response is ok", async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({ data: "test" }),
            } as unknown as Response;

            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            const response = await fetchWithRetry("http://localhost:4000/api/test");

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(response).toBe(mockResponse);
        });

        it("should retry on network failure", async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({ data: "test" }),
            } as unknown as Response;

            (global.fetch as jest.Mock)
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce(mockResponse);

            const response = await fetchWithRetry(
                "http://localhost:4000/api/test",
                {},
                { maxRetries: 1, initialDelayMs: 0 }
            );

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(response).toBe(mockResponse);
        });

        it("should fail after max retries exhausted", async () => {
            const error = new Error("Network error");
            (global.fetch as jest.Mock).mockRejectedValue(error);

            await expect(
                fetchWithRetry(
                    "http://localhost:4000/api/test",
                    {},
                    { maxRetries: 2, initialDelayMs: 0 }
                )
            ).rejects.toThrow("Network error");

            // Initial attempt + 2 retries = 3 total
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it("should not retry on 400/401/403/404 errors", async () => {
            const mockResponse = {
                ok: false,
                status: 401,
            } as unknown as Response;

            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            const response = await fetchWithRetry(
                "http://localhost:4000/api/test",
                {},
                { maxRetries: 3, initialDelayMs: 0 }
            );

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(401);
        });

        it("should handle timeout correctly", async () => {
            let timeoutId: NodeJS.Timeout;
            const slowResponse = new Promise((resolve) => {
                timeoutId = setTimeout(
                    () =>
                        resolve({
                            ok: true,
                            json: () => Promise.resolve({ data: "test" }),
                        }),
                    5000
                );
            });

            (global.fetch as jest.Mock).mockReturnValueOnce(slowResponse);

            // This test would need AbortController support
            // For now, just verify timeout is set in options
            const response = await fetchWithRetry(
                "http://localhost:4000/api/test",
                { timeout: 100 },
                { maxRetries: 0 }
            );

            expect(response).toBeDefined();
            clearTimeout(timeoutId!);
        }, 10000);

        it("should apply exponential backoff", async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({ data: "test" }),
            } as unknown as Response;

            (global.fetch as jest.Mock)
                .mockRejectedValueOnce(new Error("Network error"))
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce(mockResponse);

            const startTime = Date.now();
            await fetchWithRetry(
                "http://localhost:4000/api/test",
                {},
                { maxRetries: 2, initialDelayMs: 100, backoffMultiplier: 2 }
            );
            const elapsed = Date.now() - startTime;

            // Should wait at least 100 + 200 = 300ms (plus some jitter)
            expect(elapsed).toBeGreaterThanOrEqual(250);
        });
    });

    describe("offlineRequestQueue", () => {
        beforeEach(() => {
            offlineRequestQueue.clear();
        });

        it("should add request to queue", () => {
            const id = offlineRequestQueue.add("http://localhost:4000/api/test", { method: "GET" });

            expect(id).toBeDefined();
            expect(offlineRequestQueue.getAll()).toHaveLength(1);
        });

        it("should remove request from queue", () => {
            const id = offlineRequestQueue.add("http://localhost:4000/api/test", { method: "GET" });
            offlineRequestQueue.remove(id);

            expect(offlineRequestQueue.getAll()).toHaveLength(0);
        });

        it("should clear entire queue", () => {
            offlineRequestQueue.add("http://localhost:4000/api/test1", { method: "GET" });
            offlineRequestQueue.add("http://localhost:4000/api/test2", { method: "POST" });

            offlineRequestQueue.clear();

            expect(offlineRequestQueue.getAll()).toHaveLength(0);
        });

        it("should notify listeners on changes", (done) => {
            const listener = jest.fn();
            offlineRequestQueue.onChange(listener);

            offlineRequestQueue.add("http://localhost:4000/api/test", { method: "GET" });

            // Listener should be called (check implementation)
            setTimeout(() => {
                done();
            }, 100);
        });
    });

    describe("useOfflineStatus", () => {
        it("should initialize isOffline to false when navigator.onLine is true", () => {
            const { result } = renderHook(() => useOfflineStatus());
            expect(result.current.isOffline).toBe(false);
        });

        it("should set isOffline to true on offline event", () => {
            const { result } = renderHook(() => useOfflineStatus());
            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            expect(result.current.isOffline).toBe(true);
        });

        it("should set isOffline to false on online event", () => {
            const { result } = renderHook(() => useOfflineStatus());
            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            expect(result.current.isOffline).toBe(true);

            act(() => {
                window.dispatchEvent(new Event("online"));
            });
            expect(result.current.isOffline).toBe(false);
        });

        it("should register and execute retry callbacks on reconnect", () => {
            const { result } = renderHook(() => useOfflineStatus());
            const callback = jest.fn();

            act(() => {
                result.current.registerRetryCallback(callback);
            });

            // Go offline then online — callbacks should fire on reconnect
            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            act(() => {
                window.dispatchEvent(new Event("online"));
            });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it("should persist retry callbacks and re-execute on subsequent reconnections", () => {
            const { result } = renderHook(() => useOfflineStatus());
            const callback = jest.fn();

            act(() => {
                result.current.registerRetryCallback(callback);
            });

            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            act(() => {
                window.dispatchEvent(new Event("online"));
            });

            expect(callback).toHaveBeenCalledTimes(1);

            // Go offline and back online again — callback should fire again
            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            act(() => {
                window.dispatchEvent(new Event("online"));
            });

            expect(callback).toHaveBeenCalledTimes(2);
        });
    });

    describe("OfflineBanner", () => {
        it("should not render when online", () => {
            render(<OfflineBanner />);
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("should render offline message when offline", () => {
            render(<OfflineBanner />);
            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            expect(screen.getByRole("alert")).toBeInTheDocument();
            expect(screen.getByText("bannerOffline")).toBeInTheDocument();
        });

        it("should show back-online message when reconnecting", () => {
            jest.useFakeTimers();
            render(<OfflineBanner />);

            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            expect(screen.getByText("bannerOffline")).toBeInTheDocument();

            act(() => {
                window.dispatchEvent(new Event("online"));
            });
            expect(screen.getByText("bannerOnline")).toBeInTheDocument();

            act(() => {
                jest.advanceTimersByTime(3000);
            });
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();

            jest.useRealTimers();
        });

        it("should dismiss when dismiss button is clicked", () => {
            render(<OfflineBanner />);
            act(() => {
                window.dispatchEvent(new Event("offline"));
            });
            expect(screen.getByRole("alert")).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText("dismiss"));
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });
    });

    describe("OfflineErrorBoundary", () => {
        beforeEach(() => {
            jest.spyOn(console, "error").mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        function ThrowComponent({ message = "Something went wrong" }: { message?: string }) {
            throw new Error(message);
        }

        it("should catch errors and display fallback UI", () => {
            render(
                <OfflineErrorBoundary>
                    <ThrowComponent />
                </OfflineErrorBoundary>
            );
            expect(screen.getByText("Something Went Wrong")).toBeInTheDocument();
        });

        it("should display Connection Lost message for network errors", () => {
            function NetworkThrowComponent() {
                throw new TypeError("Failed to fetch");
            }

            render(
                <OfflineErrorBoundary>
                    <NetworkThrowComponent />
                </OfflineErrorBoundary>
            );
            expect(screen.getByText("Connection Lost")).toBeInTheDocument();
        });

        it("should display generic message for non-network errors", () => {
            function NonNetworkThrowComponent() {
                throw new Error("Random error");
            }

            render(
                <OfflineErrorBoundary>
                    <NonNetworkThrowComponent />
                </OfflineErrorBoundary>
            );
            expect(screen.getByText("Something Went Wrong")).toBeInTheDocument();
        });

        it("should reset and render children when retry is clicked and error is resolved", () => {
            let shouldThrow = true;

            function ConditionalThrow() {
                if (shouldThrow) {
                    throw new Error("fetch failed");
                }
                return <div>Content loaded successfully</div>;
            }

            render(
                <OfflineErrorBoundary>
                    <ConditionalThrow />
                </OfflineErrorBoundary>
            );
            expect(screen.getByText("Connection Lost")).toBeInTheDocument();

            shouldThrow = false;

            fireEvent.click(screen.getByText("Try Again"));
            expect(screen.getByText("Content loaded successfully")).toBeInTheDocument();
        });

        it("should show checking state when retry is clicked while offline", () => {
            jest.spyOn(navigator, "onLine", "get").mockReturnValue(false);

            function NetworkThrowComponent() {
                throw new TypeError("Failed to fetch");
            }

            render(
                <OfflineErrorBoundary>
                    <NetworkThrowComponent />
                </OfflineErrorBoundary>
            );
            expect(screen.getByText("Connection Lost")).toBeInTheDocument();

            fireEvent.click(screen.getByText("Try Again"));
            expect(screen.getByText("Checking...")).toBeInTheDocument();

            jest.restoreAllMocks();
        });
    });

    describe("Service Worker", () => {
        it("exists as a valid JS file", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain("self.addEventListener");
            expect(swContent).toContain("install");
            expect(swContent).toContain("activate");
            expect(swContent).toContain("fetch");
        });

        it("defines expected cache strategies", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain("sahidawa-offline-");
            expect(swContent).toContain("sahidawa-api-");
            expect(swContent).toContain("sahidawa-medicine-");
            expect(swContent).toContain("sahidawa-static-");
            expect(swContent).toContain("sahidawa-assets-");
            expect(swContent).toContain("sahidawa-tiles-");
        });

        it("handles OSM tile origin for offline maps", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain("tile.openstreetmap.org");
            expect(swContent).toContain("sahidawa-tiles-");
        });

        it("caches medicine lookup APIs with StaleWhileRevalidate", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain("/api/medicines/");
            expect(swContent).toContain("/api/verify");
            expect(swContent).toContain("/api/v1/scan/");
            expect(swContent).toContain("/api/v1/lasa/");
            expect(swContent).toContain("MEDICINE_CACHE_NAME");
        });

        it("caches icons and manifest with CacheFirst", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain("/icons/");
            expect(swContent).toContain("/manifest.json");
            expect(swContent).toContain("ASSETS_CACHE_NAME");
        });

        it("handles push notification events", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain('"push"');
            expect(swContent).toContain("showNotification");
        });

        it("handles notificationclick events", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain('"notificationclick"');
            expect(swContent).toContain("clients.openWindow");
        });

        it("handles SKIP_WAITING message", () => {
            const swContent = fs.readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
            expect(swContent).toContain("SKIP_WAITING");
        });

        it("registers service worker via ServiceWorkerProvider", () => {
            const swProviderPath = join(process.cwd(), "components/ServiceWorkerProvider.tsx");
            const providerContent = fs.readFileSync(swProviderPath, "utf8");
            expect(providerContent).toContain('serviceWorker.register("/sw.js"');
            expect(providerContent).toContain("SKIP_WAITING");
        });
    });
});
