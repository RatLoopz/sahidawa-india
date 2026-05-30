import { renderToStaticMarkup } from "react-dom/server";

import { MedicinePhotoUpload } from "../components/medicine/MedicinePhotoUpload";

describe("MedicinePhotoUpload", () => {
  it("renders the dropzone with file input constraints and accessibility attributes", () => {
    const markup = renderToStaticMarkup(
      <MedicinePhotoUpload onUploadComplete={() => undefined} label="Upload Medicine Photo" />
    );

    expect(markup).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(markup).toContain('capture="environment"');
    expect(markup).not.toContain("multiple");
    expect(markup).toContain('aria-label="Upload Medicine Photo — click or drag and drop"');
    expect(markup).toContain("Upload medicine photo");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Upload Medicine Photo");
  });

  it("renders disabled dropzone semantics when disabled", () => {
    const markup = renderToStaticMarkup(
      <MedicinePhotoUpload onUploadComplete={() => undefined} disabled />
    );

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("disabled");
  });
});
