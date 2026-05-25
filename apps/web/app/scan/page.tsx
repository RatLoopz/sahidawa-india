"use client";

import MedicinePhotoUpload from "@/components/MedicinePhotoUpload";

export default function ScanPage() {
  const handleUploadSuccess = (cloudinaryUrl: string) => {
    console.log("Image ready for AI processing:", cloudinaryUrl);
    // TODO: pass cloudinaryUrl to your ML service / API route
  };

  const handleUploadError = (error: string) => {
    console.error("Upload failed:", error);
  };

  return (
    <main className="min-h-screen p-6 flex flex-col items-center gap-8">
      <h1 className="text-2xl font-bold text-gray-800">Verify Your Medicine</h1>
      <p className="text-gray-500 text-sm text-center max-w-sm">
        Take a photo of the medicine packaging. Our AI will check if it's genuine.
      </p>

      <MedicinePhotoUpload
        onUploadSuccess={handleUploadSuccess}
        onUploadError={handleUploadError}
      />
    </main>
  );
}