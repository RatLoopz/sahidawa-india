# PR #4227 — feat: add image validation before medicine OCR

> **Merged:** 2026-08-08 | **Author:** @0504Siddhi | **Area:** Frontend | **Impact Score:** 12 | **Closes:** #4226

## What Changed

We added a client-side image validation step before proceeding with medicine barcode/OCR processing. This validation checks for supported image formats, adheres to the existing 10 MB file-size limit, and ensures minimum image dimensions are met. If an image fails validation, it is stopped early with clear, actionable feedback to the user. Additionally, unit tests were introduced to cover the validation logic, enhancing the overall robustness of the system.

## The Problem Being Solved

Before this PR, our system lacked a proactive validation mechanism for images uploaded for medicine verification. This omission could lead to unnecessary processing of unsupported or low-quality images, potentially resulting in failed OCR operations, wasted resources, and a subpar user experience. By introducing image validation, we address these inefficiencies and improve the system's reliability and user satisfaction.

## Files Modified

- `apps/web/hooks/useMedicineImageUpload.ts`
- `apps/web/lib/imageValidation.ts`
- `apps/web/tests/image-validation.test.ts`

## Implementation Details

The implementation involves a new `imageValidation.ts` library that exports constants for maximum allowed image size (`MEDICINE_IMAGE_MAX_SIZE`), minimum width (`MEDICINE_IMAGE_MIN_WIDTH`), and minimum height (`MEDICINE_IMAGE_MIN_HEIGHT`), as well as an array of supported image types (`SUPPORTED_MEDICINE_IMAGE_TYPES`). A key function, `validateMedicineImage`, takes a `File` object as input and returns a promise resolving to an `ImageValidationResult`, which is either `{ valid: true }` or `{ valid: false; error: string }`. This function checks the file type against the supported types, verifies that the file size does not exceed the maximum allowed, and checks the image dimensions after loading it. 

In `useMedicineImageUpload.ts`, we import and use the `validateMedicineImage` function to validate the uploaded image before proceeding with any further processing, such as compression or OCR. If the validation fails, an error message is displayed to the user, and the upload process is halted.

## Technical Decisions

We chose to implement client-side validation to provide immediate feedback to users and to reduce the load on our servers by filtering out invalid images early in the process. The `browser-image-compression` library is used for image compression to ensure that large images are resized appropriately without losing too much quality, which is crucial for successful OCR operations. For OCR itself, `Tesseract.js` is utilized due to its robustness and support for a wide range of languages.

## How To Re-Implement (Contributor Reference)

1. **Create Validation Constants and Types**: Define the maximum allowed image size, minimum dimensions, and supported image types in a separate file (e.g., `imageValidation.ts`) for easy maintenance and access across the application.
2. **Implement Image Validation Function**: Write a function (`validateMedicineImage`) that takes a `File` object, checks its type, size, and dimensions, and returns a validation result. This involves creating a temporary object URL to load the image and get its dimensions.
3. **Integrate Validation with Upload Hook**: Modify the image upload handling logic (in `useMedicineImageUpload.ts`) to call the validation function upon receiving an image file. Display an error message and stop the upload process if validation fails.
4. **Add Unit Tests**: Create tests (in `image-validation.test.ts`) to cover various validation scenarios, including different image types, sizes, and dimensions, to ensure the validation logic is robust.

## Impact on System Architecture

This change enhances the frontend's robustness by filtering out unsupported or low-quality images early, reducing the likelihood of failed OCR operations and improving the overall user experience. It also sets a precedent for proactive validation of user input, which can be applied to other areas of the application, contributing to a more reliable and efficient system architecture.

## Testing & Verification

Testing involved creating a suite of unit tests (`image-validation.test.ts`) that cover various scenarios, including:
- Valid JPEG, PNG, and WebP images
- Unsupported image formats
- Images exceeding the 10 MB limit
- Images below the minimum width or height
- Unreadable/corrupted images
- Temporary object URLs are cleaned up correctly

These tests ensure that the validation logic correctly identifies valid and invalid images under different conditions, providing a solid foundation for the feature's reliability.