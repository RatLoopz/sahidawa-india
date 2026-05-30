import { validateMedicineFile } from "../components/medicine/validateMedicineFile";

function makeFile(type: string, size: number): File {
  return { type, size } as File;
}

describe("validateMedicineFile", () => {
  it("accepts allowed types within size limit", () => {
    expect(validateMedicineFile(makeFile("image/jpeg", 100))).toEqual({ valid: true });
    expect(validateMedicineFile(makeFile("image/png", 100))).toEqual({ valid: true });
    expect(validateMedicineFile(makeFile("image/webp", 0))).toEqual({ valid: true });
  });

  it("accepts image/jpeg at exactly 5 MB", () => {
    const fiveMb = 5 * 1024 * 1024;
    expect(validateMedicineFile(makeFile("image/jpeg", fiveMb))).toEqual({ valid: true });
  });

  it("rejects unsupported MIME types", () => {
    const result = validateMedicineFile(makeFile("image/gif", 100));
    expect(result).toEqual({
      valid: false,
      error: "Only JPG, PNG, and WebP images are supported.",
    });
  });

  it("rejects files over 5 MB with size in the message", () => {
    const overLimit = 5 * 1024 * 1024 + 1;
    const result = validateMedicineFile(makeFile("image/jpeg", overLimit));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("File is too large");
      expect(result.error).toContain("5.0 MB");
    }
  });

  it("always returns a discriminated union with a non-empty error when invalid", () => {
    const samples = [
      makeFile("", 0),
      makeFile("application/pdf", 1024),
      makeFile("image/jpeg", 6 * 1024 * 1024),
    ];

    for (const file of samples) {
      const result = validateMedicineFile(file);
      if (!result.valid) {
        expect(result.error.length).toBeGreaterThan(0);
      }
    }
  });
});
