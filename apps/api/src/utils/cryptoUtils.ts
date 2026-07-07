import crypto from "crypto";
/**
 * Performs a timing-safe comparison between two strings.
 *
 * @param a The first string to compare.
 * @param b The second string to compare.
 * @returns True if both strings are equal, otherwise false.
 */

export function safeCompare(a: string, b: string): boolean {
    const hashA = crypto.createHash("sha256").update(a).digest();
    const hashB = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}
