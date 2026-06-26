import { Request } from "express";

export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : [
          "http://localhost:3000",
          "http://localhost:5173",
          "https://sahidawa.vercel.app",
          "https://sahidawa-india.vercel.app",
          "https://sahidawa.goswav.in",
      ];

export function isAllowedOrigin(req: Request, requireOrigin = false): boolean {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source = origin || (referer ? new URL(referer).origin : null);
    if (!source) return !requireOrigin;
    return ALLOWED_ORIGINS.includes(source);
}
