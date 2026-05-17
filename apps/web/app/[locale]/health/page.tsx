"use client";

import dynamic from "next/dynamic";

const ChatUI = dynamic(() => import("@/app/components/health/ChatUI"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 2px 8px rgba(22,163,74,0.3)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M17 8C8 10 5.9 16.17 3.82 19.71L5.71 21l1-1.71c.19.13.39.26.59.37C9 21.07 11 22 14 22c3.56 0 6.83-1.63 9-4.56V3l-4 2-2-3-4.5 5.5C11.5 8 14 8 17 8z" />
          </svg>
        </div>
        <p style={{ fontFamily: "system-ui", fontSize: 13, color: "#6b7280" }}>Loading SahiDawa…</p>
      </div>
    </div>
  ),
});

export default function HealthPage() {
  return <ChatUI />;
}