"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#000000",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "0 16px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "120px",
          fontWeight: "800",
          color: "#10b981",
          margin: "0 0 16px 0",
          lineHeight: 1,
          letterSpacing: "-4px",
        }}
      >
        404
      </h1>

      <h2
        style={{
          fontSize: "24px",
          fontWeight: "600",
          color: "#ffffff",
          margin: "0 0 12px 0",
        }}
      >
        Medicine not found... but we can help!
      </h2>

      <p
        style={{
          fontSize: "16px",
          color: "#a1a1aa",
          margin: "0 0 32px 0",
          maxWidth: "420px",
        }}
      >
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link
        href="/"
        style={{
          display: "inline-block",
          backgroundColor: "#10b981",
          color: "#ffffff",
          fontSize: "15px",
          fontWeight: "600",
          textDecoration: "none",
          borderRadius: "9999px",
          padding: "12px 24px",
          transition: "background-color 0.2s ease",
        }}
        onMouseOver={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.backgroundColor =
          "#059669")
        }
        onMouseOut={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.backgroundColor =
          "#10b981")
        }
      >
        Back to Home
      </Link>
    </div>
  );
}
