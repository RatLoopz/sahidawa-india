# PR #845 — feat(ml): connect medicine image analysis

> **Merged:** 2026-05-29 | **Author:** @saurabhhhcodes | **Area:** ML/AI | **Impact Score:** 53 | **Closes:** #587

## What Changed

This pull request introduces a new, dedicated machine learning (ML) service endpoint for analyzing medicine packaging images and integrates it into our existing API and web platform. We now have a FastAPI-based `/analyze` endpoint in the `apps/ml` service that performs preliminary visual quality checks on Cloudinary-hosted images. This ML service is proxied through a new `/api/ml/analyze` endpoint in our `apps/api` Express application, which handles request/response validation and timeout management. Finally, the web application's report wizard (`apps/web/components/reports/ReportWizard.tsx`) is updated to send uploaded image URLs to this new endpoint and display the resulting verdict and confidence score to the user.

## The Problem Being Solved

Before this PR, our SahiDawa platform lacked an automated mechanism to verify the authenticity or quality of medicine packaging images uploaded by users. This meant that reports on potentially counterfeit or substandard medicines relied solely on manual inspection or user-provided text descriptions, which is inefficient and prone to human error. Issue #587 highlighted the critical need for an initial, automated visual assessment to provide immediate feedback to users and help prioritize reports for further human review. By implementing an image analysis pipeline, we aim to:
1.  **Enhance Counterfeit Detection**: Provide an early warning system for suspicious packaging.
2.  **Improve Data Quality**: Ensure uploaded images meet basic quality standards for subsequent analysis.
3.  **Streamline Reporting**: Give users immediate, data-driven feedback on their submissions, improving the user experience and encouraging more accurate reporting.
4.  **Reduce Manual Load**: Automate preliminary checks, allowing our verification team to focus on more complex cases.

## Files Modified

-   `apps/api/src/app.ts`
-   `apps/api/src/routes/ml.ts`
-   `apps/api/tests/ml.test.ts`
-   `apps/ml/main.py`
-   `apps/ml/routers/analyze.py`
-   `apps/ml/tests/test_analyze.py`
-   `apps/web/components/reports/ReportWizard.tsx`
-   `apps/web/lib/api.ts`

## Implementation Details

This feature was implemented across three main components of our monorepo: the `apps/ml` Python service, the `apps/api` Node.js Express service, and the `apps/web` React frontend.

**1. `apps/ml` Python Service (FastAPI)**

*   **`apps/ml/main.py`**: We updated the main FastAPI application to include the new `routers.analyze` module. The `include_router_if_available` function now ensures that the image analysis routes are loaded, marking them as `required=True` for the ML service to function correctly.
*   **`apps/ml/routers/analyze.py`**: This new file defines the core image analysis logic.
    *   **Models**: `AnalyzeImageRequest` (Pydantic `BaseModel`) expects a `imageUrl: HttpUrl`. `AnalyzeImageResponse` defines the output structure: `isFake: bool`, `confidence: float`, `verdict: str`, and `details: str`.
    *   **`_canonical_cloudinary_image_url(url: str)`**: This private helper function performs strict validation and canonicalization of the input `imageUrl`. It enforces:
        *   HTTPS scheme.
        *   Host must be `res.cloudinary.com`.
        *   No extra URL parameters (query, fragment, params).
        *   Path must conform to a standard Cloudinary image asset structure (e.g., `/upload/image.jpg`).
        *   If any validation fails, it raises an `HTTPException` with status code 400. This is crucial for security and ensuring we only process trusted, direct image links.
    *   **`_read_limited_image(url: str)`**: This function handles downloading the image from the canonicalized URL.
        *   It uses `requests.get` with a `REQUEST_TIMEOUT_SECONDS` (6 seconds) and `stream=True` to prevent large downloads from blocking the service.
        *   It checks the `Content-Type` header against `SUPPORTED_CONTENT_TYPES` (`image/jpeg`, `image/png`, `image/webp`).
        *   It enforces a `MAX_IMAGE_BYTES` limit (8 MB) by iteratively reading chunks and raising an `HTTPException` (status 413) if exceeded.
        *   Error handling for network issues (`requests.RequestException`) results in a 502 HTTP error.
    *   **`_score_packaging_image(image_bytes: bytes)`**: This function implements the preliminary visual quality analysis.
        *   It uses `Pillow` (`PIL.Image`) to open the image from bytes.
        *   The image is converted to RGB and then resized (thumbnail to 512x512) to standardize processing and reduce computation.
        *   It converts the image to grayscale (`L` mode) to calculate `brightness` (mean pixel value) and `contrast` (standard deviation of pixel values) using `ImageStat.Stat`.
        *   It also calculates the `channel_spread` (PSTDEV of RGB channel means) to assess color vibrancy/diversity.
        *   A `quality_score` is computed as a weighted sum of normalized brightness, contrast, and channel spread.
        *   Based on thresholds for brightness, contrast, and the overall `quality_score`, it returns an `AnalyzeImageResponse` with a `verdict` (`likely_genuine`, `suspicious`, `likely_fake`) and `confidence`. For instance, very low brightness (<35) or contrast (<9) immediately flags an image as "likely_fake".
    *   **`@router.post("")`**: The main endpoint that orchestrates the above functions, taking `AnalyzeImageRequest` and returning `AnalyzeImageResponse`.

**2. `apps/api` Node.js Express Service**

*   **`apps/api/src/routes/ml.ts`**: This new file defines an Express router for ML-related endpoints.
    *   **Schema Validation**: `zod` is used to define `analyzeRequestSchema` (ensuring `imageUrl` is a valid HTTPS URL) and `analyzeResponseSchema` (validating the structure of the ML service's response, including `isFake`, `confidence`, `verdict`, and `details`).
    *   **Configuration**: `ML_SERVICE_URL` (defaults to `http://localhost:8000`) and `ML_ANALYSIS_TIMEOUT_MS` (8 seconds) are configured via environment variables.
    *   **`router.post("/analyze", ...)`**: This is the proxy endpoint.
        *   It first validates the incoming request body against `analyzeRequestSchema`. If invalid, it returns a 400 error.
        *   It then initiates a `fetch` call to the `ML_SERVICE_URL/analyze` endpoint.
        *   **Timeout Handling**: An `AbortController` and `setTimeout` are used to abort the `fetch` request if it exceeds `ML_ANALYSIS_TIMEOUT_MS`. This prevents the API from hanging indefinitely if the ML service is slow or unresponsive, returning a 504 (Gateway Timeout) in such cases.
        *   **Response Handling**:
            *   If the ML service returns a non-2xx status, the proxy forwards the status and any error details.
            *   If the ML service's response body does not conform to `analyzeResponseSchema`, a 502 (Bad Gateway) error is returned, indicating an issue with the upstream service's contract.
            *   On success, the ML service's response is directly forwarded to the client with a 200 status.
        *   General `try...catch` blocks handle network errors, returning a 502 (Bad Gateway) if the ML service is unavailable.
*   **`apps/api/src/app.ts`**: The main Express application file is updated to register the new `mlRouter` under the `/api/ml` path.

**3. `apps/web` React Frontend**

*   **`apps/web/lib/api.ts`**: Not documented in this PR, but based on the description, this file would be updated to include a new API client function, e.g., `analyzeMedicineImage(imageUrl: string)`, which makes a `POST` request to `/api/ml/analyze`.
*   **`apps/web/components/reports/ReportWizard.tsx`**: Not documented in this PR, but based on the description, this component would be updated to:
    *   Capture the Cloudinary URL of an uploaded medicine packaging image.
    *   Call the new API client function from `apps/web/lib/api.ts` with this URL.
    *   Display the `verdict` and `confidence` received from the API response to the user within the report creation flow, providing immediate feedback.
    *   Handle loading states and potential errors from the image analysis.

## Technical Decisions

1.  **Monorepo Structure and Service Separation**: We chose to implement the image analysis as a distinct FastAPI service within the `apps/ml` directory. This decision aligns with our monorepo strategy, allowing for:
    *   **Technology Specialization**: Python is ideal for ML workloads due to its rich ecosystem (PyTorch, TensorFlow, scikit-learn, Pillow, etc.).
    *   **Independent Scaling**: The ML service can be scaled independently of the main API, optimizing resource usage.
    *   **Clear Boundaries**: Decouples the core business logic in `apps/api` from computationally intensive ML tasks.
2.  **FastAPI for ML Service**: FastAPI was selected for the Python ML service due to its:
    *   **High Performance**: Built on Starlette and Pydantic, it's very fast.
    *   **Automatic Documentation**: Generates OpenAPI (Swagger) docs automatically from Pydantic models and type hints.
    *   **Pydantic Integration**: Simplifies request/response validation and serialization, ensuring robust API contracts.
    *   **Asynchronous Support**: Allows for efficient handling of I/O-bound tasks like image downloading.
3.  **Express Proxy in `apps/api`**: Instead of allowing the frontend to directly call the `apps/ml` service, we introduced an Express proxy. This decision was made for several reasons:
    *   **Security**: Centralizes API access, preventing direct exposure of the ML service to the public internet. It allows us to enforce authentication/authorization at the `apps/api` layer before forwarding requests.
    *   **Validation**: The Express proxy provides an additional layer of input validation (`zod`) and output validation, ensuring that both the client request and the ML service response adhere to expected schemas.
    *   **Timeout Management**: The proxy handles timeouts, preventing client-side requests from hanging and providing a consistent error experience.
    *   **Environment Abstraction**: The frontend only needs to know about the `apps/api` URL, and the `apps/api` service manages the `ML_SERVICE_URL` environment variable, making deployment more flexible.
    *   **Future Enhancements**: The proxy can easily be extended for caching, rate limiting, or request/response transformation without modifying the ML service or frontend.
4.  **Zod for Schema Validation**: `zod` was chosen for schema validation in the Express proxy because it is:
    *   **Type-Safe**: Provides excellent TypeScript inference, improving developer experience.
    *   **Powerful**: Supports complex schemas, transformations, and custom validations.
    *   **Performant**: Efficiently validates data at runtime.
    *   **Developer-Friendly**: Clear error messages and an intuitive API.
5.  **Strict Cloudinary URL Restriction**: The `_canonical_cloudinary_image_url` function strictly enforces HTTPS and `res.cloudinary.com` as the image host. This is a critical security decision to:
    *   **Prevent SSRF (Server-Side Request Forgery)**: By limiting the domains the ML service can fetch from, we mitigate risks of attackers tricking our server into making requests to internal or malicious systems.
    *   **Ensure Reliability**: Cloudinary is our chosen image hosting provider, ensuring consistent image availability and performance.
    *   **Control Input**: Standardizes the input format, simplifying parsing and processing.
6.  **Heuristic-Based Scoring**: The initial `_score_packaging_image` function uses a heuristic approach based on brightness, contrast, and color spread. This was chosen as a pragmatic first step because:
    *   **Rapid Deployment**: It's simpler and faster to implement than training a complex deep learning model.
    *   **Immediate Value**: Provides immediate, tangible feedback on basic image quality, which is often a strong indicator of a poor-quality or tampered image.
    *   **Foundation for Future ML**: Lays the groundwork for integrating more sophisticated ML models (e.g., object detection, anomaly detection) in future iterations, as the image fetching and processing pipeline is already established.
7.  **`AbortController` for Timeout Handling**: Using `AbortController` with `fetch` in the Express proxy is the standard and most robust way to implement request timeouts in Node.js, ensuring that resources are not tied up indefinitely by unresponsive upstream services.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Set up the `apps/ml` FastAPI Service:**
    *   Create a new Python file, e.g., `apps/ml/routers/analyze.py`.
    *   Define Pydantic models for `AnalyzeImageRequest` (e.g., `imageUrl: HttpUrl`) and `AnalyzeImageResponse` (e.g., `isFake: bool`, `confidence: float`, `verdict: str`, `details: str`).
    *   Implement a URL canonicalization and validation function (`_canonical_cloudinary_image_url`) that strictly checks for HTTPS, `res.cloudinary.com` host, and absence of extra URL parameters. Raise `HTTPException(400)` for invalid URLs.
    *   Implement an image download function (`_read_limited_image`) using `requests` with streaming (`stream=True`), a timeout, and content-type validation. Crucially, implement a byte-limit check (`MAX_IMAGE_BYTES`) while iterating through chunks to prevent large file attacks, raising `HTTPException(413)`. Handle `requests.RequestException` by raising `HTTPException(502)`.
    *   Implement the image scoring logic (`_score_packaging_image`) using `Pillow`. This involves:
        *   Opening the image from bytes (`Image.open(io.BytesIO(image_bytes))`).
        *   Converting to RGB and thumbnailing (e.g., `image.thumbnail((512, 512))`).
        *   Converting to grayscale (`image.convert("L")`) to calculate brightness (`ImageStat.Stat(grayscale).mean[0]`) and contrast (`ImageStat.Stat(grayscale).stddev[0]`).
        *   Calculating color channel spread (`pstdev` of `ImageStat.Stat(image).mean`).
        *   Defining a heuristic `quality_score` based on these metrics and mapping it to `isFake`, `confidence`, `verdict`, and `details` based on predefined thresholds. Raise `HTTPException(400)` for unreadable images.
    *   Define the FastAPI `APIRouter` and a `POST` endpoint (e.g., `@router.post("")`) that takes the `AnalyzeImageRequest` payload, calls the download and scoring functions, and returns the `AnalyzeImageResponse`.
    *   In `apps/ml/main.py`, import and include this router using `app.include_router(analyze_router)`.
    *   Ensure `requests` and `Pillow` are listed in `apps/ml/requirements.txt`.

2.  **Set up the `apps/api` Express Proxy Service:**
    *   Create a new Express router file, e.g., `apps/api/src/routes/ml.ts`.
    *   Define `zod` schemas for the incoming request body (`analyzeRequestSchema`, requiring an HTTPS `imageUrl`) and the expected ML service response (`analyzeResponseSchema`, including `isFake`, `confidence`, `verdict`, `details`).
    *   Define environment variables for the ML service URL (e.g., `ML_SERVICE_URL`) and a timeout duration (e.g., `ML_ANALYSIS_TIMEOUT_MS`).
    *   Create a `POST /analyze` route on this router.
    *   Inside the route handler:
        *   Parse and validate `req.body` using `analyzeRequestSchema.safeParse()`. Return 400 if validation fails.
        *   Initialize an `AbortController` and set a `setTimeout` to call `controller.abort()` after `ML_ANALYSIS_TIMEOUT_MS`.
        *   Make a `fetch` request to `${ML_SERVICE_URL}/analyze` with `method: "POST"`, `headers: { "Content-Type": "application/json" }`, `body: JSON.stringify(parsed.data)`, and `signal: controller.signal`.
        *   In the `try` block:
            *   Await `mlResponse.json()`.
            *   Check `mlResponse.ok`. If false, forward the ML service's status and error details.
            *   Validate the ML service's JSON response using `analyzeResponseSchema.safeParse()`. If invalid, return a 502 error.
            *   If all successful, return `res.status(200).json(analysis.data)`.
        *   In the `catch` block:
            *   Check if the error is an `AbortError`. If so, return 504 (Gateway Timeout).
            *   Otherwise, return 502 (Bad Gateway) for other network/service unavailability issues.
        *   In the `finally` block, `clearTimeout` for the `AbortController`.
    *   In `apps/api/src/app.ts`, import and register this router: `app.use("/api/ml", mlRouter);`.
    *   Ensure `zod` is listed in `apps/api/package.json` dependencies.

3.  **Integrate into `apps/web` Frontend:**
    *   In `apps/web/lib/api.ts`, create an asynchronous function (e.g., `analyzeImage`) that takes an `imageUrl: string` and makes a `POST` request to `/api/ml/analyze`, returning the `AnalyzeImageResponse`.
    *   In `apps/web/components/reports/ReportWizard.tsx` (or relevant component):
        *   When a user uploads an image and its Cloudinary URL is available, call the `analyzeImage` API function.
        *   Manage loading states while the analysis is in progress.
        *   Upon receiving a response, extract `verdict` and `confidence` and display them prominently to the user.
        *   Handle potential errors from the API call (e.g., display an error message if analysis fails or times out).

## Impact on System Architecture

This PR significantly evolves our SahiDawa system architecture by:

1.  **Introducing a Dedicated ML Service Layer**: We now have a distinct `apps/ml` service, establishing a clear pattern for integrating future machine learning capabilities. This promotes modularity, allows for independent technology stacks (Python for ML, Node.js for API), and enables separate scaling and deployment of ML workloads.
2.  **Enhancing Data Verification Pipeline**: The image analysis endpoint adds a crucial automated verification step to our medicine reporting process. This moves us towards a more robust and intelligent platform for identifying potentially counterfeit or substandard medicines, reducing reliance on purely manual review.
3.  **Improving User Feedback**: By providing immediate verdicts and confidence scores in the report wizard, we empower users with real-time insights, improving the quality of submitted reports and fostering trust in the platform.
4.  **Strengthening API Security and Robustness**: The Express proxy in `apps/api` acts as a secure gateway, validating requests, enforcing timeouts, and abstracting the ML service's internal details. This pattern enhances the overall security posture and resilience of our API.
5.  **Laying Groundwork for Advanced ML**: While the current image analysis uses heuristics, the established infrastructure (FastAPI service, API proxy, frontend integration, Cloudinary URL handling) provides a solid foundation for seamlessly integrating more sophisticated deep learning models for image classification, object detection, or anomaly detection in the future without significant architectural changes.
6.  **Centralized Image Fetching**: By having the ML service fetch images from Cloudinary, we centralize the logic for handling external image resources, ensuring consistent security checks (HTTPS, domain restriction) and resource management (size limits, timeouts).

## Testing & Verification

The changes introduced in this PR were thoroughly tested at multiple levels:

1.  **Unit Tests for `apps/ml` Python Service (`apps/ml/tests/test_analyze.py`)**:
    *   We added a new test file to specifically validate the core logic of the image analysis service.
    *   Tests cover the `_canonical_cloudinary_image_url` function, ensuring it correctly rejects non-HTTPS, non-Cloudinary, or malformed Cloudinary URLs, and accepts valid ones.
    *   Tests for `_read_limited_image` (though not explicitly shown in the truncated diff, implied by the `_image_bytes` helper) would verify image downloading, size limits, and content type checks.
    *   Tests for `_score_packaging_image` use helper functions like `_image_bytes` to create synthetic images of specific colors/patterns, allowing us to assert expected brightness, contrast, and quality scores, and verify that different image qualities lead to the correct `verdict` and `confidence` (e.g., a very dark image yields "likely_fake", a clear image yields "likely_genuine").
    *   The verification command `python3 -m pytest apps/ml/tests/test_analyze.py -q` confirms these tests pass.
    *   The `py_compile` command `PYTHONPYCACHEPREFIX=/private/tmp/sahidawa-587-pycache python3 -m py_compile apps/ml/routers/analyze.py apps/ml/tests/test_analyze.py` ensures the Python code is syntactically correct and compilable.

2.  **Unit Tests for `apps/api` Express Proxy (`apps/api/tests/ml.test.ts`)**:
    *   A new test file was added to verify the behavior of the Express proxy.
    *   Tests use `supertest` to simulate HTTP requests to the `/api/ml/analyze` endpoint.
    *   One test specifically asserts that the proxy rejects non-HTTPS `imageUrl`s with a 400 status, validating the `zod` schema.
    *   Another test mocks `global.fetch` to simulate a successful response from the ML service and asserts that the proxy correctly forwards the response (e.g., `response.body.verdict` is `likely_genuine`).
    *   Implicitly, tests would also cover scenarios like ML service timeouts (resulting in 504), ML service errors (forwarding status), and invalid ML service responses (resulting in 502).
    *   The verification command `npm run test --workspace=sahidawa-api -- ml.test.ts` confirms these tests pass.

3.  **Static Analysis and Build Checks**:
    *   `npm run build --workspace=sahidawa-api` and `npm run build --workspace=web` ensure that both the API and web applications compile successfully after the changes, catching any TypeScript or build configuration issues.
    *   `node apps/web/node_modules/eslint/bin/eslint.js apps/web/components/reports/ReportWizard.tsx apps/web/lib/api.ts` ensures that the frontend code adheres to our ESLint rules, maintaining code quality and consistency.

**Edge Cases Considered**:
*   **Invalid `imageUrl`**: Handled by `zod` validation in `apps/api` and `_canonical_cloudinary_image_url` in `apps/ml`.
*   **Non-image content at URL**: Handled by `content-type` check in `_read_limited_image` and `Pillow`'s `UnidentifiedImageError`.
*   **Excessively large images**: Handled by `MAX_IMAGE_BYTES` limit in `_read_limited_image`.
*   **ML service unavailability/timeout**: Handled by `AbortController` and `try...catch` in `apps/api/src/routes/ml.ts`, returning 504 or 502.
*   **ML service returning malformed response**: Handled by `zod` validation of `analyzeResponseSchema` in `apps/api`.
*   **Very low-quality images**: Explicitly handled by the heuristic scoring in `_score_packaging_image` to return "likely_fake" or "suspicious" verdicts.