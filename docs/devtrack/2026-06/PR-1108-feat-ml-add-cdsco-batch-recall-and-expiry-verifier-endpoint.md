# PR #1108 — feat(ml): add CDSCO batch recall and expiry verifier endpoint

> **Merged:** 2026-06-02 | **Author:** @Kinara2020 | **Area:** ML/AI | **Impact Score:** 24 | **Closes:** #1098

## What Changed

We have implemented a new `POST /verify/batch` endpoint within our `apps/ml` FastAPI microservice. This endpoint allows us to verify medicine batch numbers against our internal CDSCO seed data (`data/seeds/medicines.csv`), determining if a medicine is valid, recalled, expired, or not found. This backend functionality now provides the core verification engine for the SahiDawa platform.

## The Problem Being Solved

India faces a significant crisis with 12–25% of medicines being fake or substandard, directly impacting 1.4 billion people. Recent incidents, such as the Delhi Police busting a ring selling counterfeit medicines, highlight the urgent need for citizens to verify medicine batches before consumption. Prior to this PR, SahiDawa's existing scanner UI (`apps/web/`) lacked a functional verification engine, relying on an unavailable Node API, leaving citizens with no reliable way to check medicine authenticity or status through our platform.

## Files Modified

- `apps/ml/main.py`
- `apps/ml/routers/verify.py`
- `apps/ml/tests/test_verify.py`

## Implementation Details

This pull request primarily introduces the core medicine batch verification logic within the `apps/ml` microservice.

1.  **New Router Definition (`apps/ml/routers/verify.py`):**
    - We created a new FastAPI `APIRouter` instance, `router`, with the prefix `/verify` and tagged it as "Verification".
    - **Data Loading:** Upon service startup, the `medicines.csv` seed data, located at `../../../data/seeds/medicines.csv`, is loaded into a global pandas DataFrame, `df`. This ensures that the dataset is loaded once and is readily available for quick lookups. A `try-except` block handles potential `Exception` during CSV loading, initializing `df` as an empty DataFrame if an error occurs.
    - **Pydantic Models:**
        - `BatchVerifyRequest`: Defines the expected request body for the `/verify/batch` endpoint. It requires a `batch_number` (string) and optionally accepts a `manufacturer` (string).
        - `BatchVerifyResponse`: Defines the structure of the response body. It includes a `status` field (a `Literal` type allowing only "valid", "recalled", "expired", or "not_found") and optional fields for `brand_name`, `generic_name`, `manufacturer`, `composition`, `expiry_date`, `cdsco_approval_status`, `is_counterfeit_alert`, and a `source` field defaulting to "database".
    - **`verify_batch` Endpoint:**
        - The `async def verify_batch(request: BatchVerifyRequest)` function is exposed as a `POST` endpoint at `/verify/batch`.
        - **Database Availability Check:** It first checks if `df` is empty (indicating a failed CSV load). If so, it raises an `HTTPException` with a `503 Service Unavailable` status and a "Medicine database unavailable" detail.
        - **Batch Number Lookup:** The incoming `request.batch_number` is converted to uppercase and used to filter the `df` for a case-insensitive match against the `batch_number` column.
        - **Not Found Handling:** If the `result` DataFrame from the filter is empty, a `BatchVerifyResponse` with `status="not_found"` is immediately returned.
        - **Status Determination:** If a match is found, the first matching row (`result.iloc[0]`) is used to determine the medicine's status:
            - `is_counterfeit`: Determined by checking if `row["is_counterfeit_alert"]` (converted to lowercase string) is "true".
            - `is_banned`: Determined by checking if `row["cdsco_approval_status"]` (converted to lowercase string) is "banned".
            - `is_expired`: The `expiry_date` from the row is parsed into a `datetime.date` object using `pd.to_datetime`. This is then compared against `date.today()`. A `try-except` block handles potential errors during date parsing.
            - **Prioritized Status Logic:** The final `status` is determined with the following priority:
                1.  "recalled" if `is_counterfeit` or `is_banned` is true.
                2.  "expired" if `is_expired` is true.
                3.  "valid" otherwise.
        - **Response Construction:** A `BatchVerifyResponse` object is constructed using the determined `status` and all relevant medicine details extracted from the `row`, ensuring all values are converted to strings.

2.  **Router Registration (`apps/ml/main.py`):**
    - We added `include_router_if_available(app, "routers.verify", required=True)` to the `main.py` file. This registers the newly created `verify` router with the main FastAPI application, making its endpoints accessible. The `required=True` flag ensures that the ML service will not start if the `verify` router cannot be loaded, indicating a critical dependency.

3.  **Unit Tests (`apps/ml/tests/test_verify.py`):**
    - A new test file was created using `fastapi.testclient.TestClient` to test the `app`.
    - `test_health()`: Verifies the basic health endpoint of the ML service.
    - `test_valid_medicine()`: Posts a request for "DL23X1" and asserts a "valid" status and correct `brand_name`.
    - `test_counterfeit_medicine()`: Posts a request for "DL23X9" and asserts a "recalled" status and `is_counterfeit_alert` as `True`.
    - `test_not_found()`: Posts a request for "FAKE999" and asserts a "not_found" status.
    - `test_missing_batch_number()`: Posts an empty JSON request to test FastAPI's Pydantic validation, asserting a `422 Unprocessable Entity` status code.

## Technical Decisions

- **FastAPI for ML Microservice:** We chose FastAPI for the `apps/ml` microservice due to its high performance, asynchronous capabilities, automatic data validation and serialization via Pydantic, and built-in interactive API documentation (Swagger UI). This aligns with our strategy for building efficient and maintainable ML-focused APIs.
- **Pandas for Seed Data Handling:** Using pandas to load and query `medicines.csv` was a pragmatic choice for handling static seed data. It provides efficient in-memory data manipulation and querying capabilities, which are suitable for a relatively small, read-only dataset that needs fast lookups without the overhead of a full database query for every request.
- **In-Memory Data Loading:** Loading the `medicines.csv` into a global pandas DataFrame (`df`) at application startup ensures that subsequent API calls benefit from extremely fast lookups, as the data is already in memory. This avoids repeated disk I/O or database connections for each verification request.
- **Pydantic for Request/Response Schemas:** Pydantic models (`BatchVerifyRequest`, `BatchVerifyResponse`) were used to define clear, type-hinted data structures for API requests and responses. This provides automatic data validation, serialization, and deserialization, reducing boilerplate code and improving API reliability and developer experience. The `Literal` type for `status` enforces strict adherence to predefined outcomes.
- **Case-Insensitive Batch Number Matching:** We implemented case-insensitive matching for `batch_number` (`.astype(str).str.upper() == request.batch_number.upper()`). This decision enhances user experience by making the verification process more robust against variations in user input.
- **Prioritized Status Logic:** The logic for determining the final `status` (recalled > expired > valid) reflects a critical safety priority. Counterfeit or banned medicines pose the highest risk and must be flagged as "recalled" immediately, even if they are also expired. Expired medicines are a lower but still significant risk, taking precedence over valid ones.
- **Robust Error Handling:** The inclusion of checks for `df.empty` (raising `HTTPException 503`) and `try-except` blocks around `expiry_date` parsing ensures that the API gracefully handles scenarios where the data source is unavailable or contains malformed data, preventing crashes and providing informative error messages.
- **Frontend Integration (Not in this PR's diff):** While the PR description mentions updating `apps/web/lib/api.ts` to call this new ML service endpoint and mapping its response to the existing `VerifyResult` type, the actual code changes for this frontend integration are not present in the provided Git diff for this specific pull request. We understand this was part of the overall feature delivery, but the specific frontend file modifications are not documented within this PR's scope.

## How To Re-Implement (Contributor Reference)

To re-implement the medicine batch verification feature in the `apps/ml` microservice, a contributor would follow these steps:

1.  **Create the Router File:**
    - Create a new Python file, e.g., `apps/ml/routers/verify.py`.
    - Initialize a FastAPI `APIRouter`: `router = APIRouter(prefix="/verify", tags=["Verification"])`.

2.  **Prepare Seed Data:**
    - Ensure the `data/seeds/medicines.csv` file exists and contains columns like `batch_number`, `brand_name`, `generic_name`, `manufacturer`, `composition`, `expiry_date`, `cdsco_approval_status`, and `is_counterfeit_alert`.
    - In `verify.py`, define the `CSV_PATH` relative to the router file:
        ```python
        CSV_PATH = os.path.join(
            os.path.dirname(__file__),
            "../../../data/seeds/medicines.csv"
        )
        ```
    - Load the CSV into a pandas DataFrame globally at module level for efficient access:
        ```python
        try:
            df = pd.read_csv(CSV_PATH)
            df.columns = df.columns.str.strip().str.lower() # Normalize column names
        except Exception:
            df = pd.DataFrame() # Handle cases where CSV is missing or malformed
        ```

3.  **Define Pydantic Models:**
    - Create `BaseModel` classes for the request and response bodies:

        ```python
        class BatchVerifyRequest(BaseModel):
            batch_number: str
            manufacturer: Optional[str] = None

        class BatchVerifyResponse(BaseModel):
            status: Literal["valid", "recalled", "expired", "not_found"]
            brand_name: Optional[str] = None
            # ... other fields as defined in the PR ...
            source: str = "database"
        ```

4.  **Implement the Verification Endpoint:**
    - Define the `POST` endpoint function:

        ```python
        @router.post("/batch", response_model=BatchVerifyResponse)
        async def verify_batch(request: BatchVerifyRequest):
            if df.empty:
                raise HTTPException(status_code=503, detail="Medicine database unavailable")

            # Case-insensitive batch number lookup
            result = df[df["batch_number"].astype(str).str.upper() == request.batch_number.upper()]

            if result.empty:
                return BatchVerifyResponse(status="not_found")

            row = result.iloc[0]

            # Determine counterfeit, banned, and expired status
            is_counterfeit = str(row["is_counterfeit_alert"]).lower() == "true"
            is_banned = str(row["cdsco_approval_status"]).lower() == "banned"
            is_expired = False
            try:
                expiry = pd.to_datetime(row["expiry_date"]).date()
                is_expired = expiry < date.today()
            except Exception:
                pass # Handle invalid date formats gracefully

            # Prioritized status logic
            if is_counterfeit or is_banned:
                status = "recalled"
            elif is_expired:
                status = "expired"
            else:
                status = "valid"

            # Construct and return the response
            return BatchVerifyResponse(
                status=status,
                brand_name=str(row["brand_name"]),
                # ... populate other fields ...
                is_counterfeit_alert=is_counterfeit,
                source="database"
            )
        ```

5.  **Register the Router:**
    - In `apps/ml/main.py`, add the following line to include the new router:
        ```python
        from .utils import include_router_if_available # Assuming this utility exists
        include_router_if_available(app, "routers.verify", required=True)
        ```

6.  **Write Unit Tests:**
    - Create `apps/ml/tests/test_verify.py`.
    - Use `fastapi.testclient.TestClient` to simulate requests.
    - Write tests for all expected outcomes: valid, recalled, expired (if data allows), not found, and validation errors (e.g., missing `batch_number`).

        ```python
        from fastapi.testclient import TestClient
        from main import app # Assuming main.py exposes the FastAPI app

        client = TestClient(app)

        def test_valid_medicine():
            res = client.post("/verify/batch", json={"batch_number": "DL23X1"})
            assert res.status_code == 200
            assert res.json()["status"] == "valid"
            # ... other assertions ...
        ```

## Impact on System Architecture

This change significantly impacts our system architecture by establishing the `apps/ml` microservice as the authoritative backend for medicine batch verification.

- **Core Feature Enablement:** It unlocks a critical, citizen-facing feature that was previously non-functional, directly addressing the core mission of SahiDawa to combat fake medicines. The ML microservice now provides the intelligence required for real-time verification.
- **Shift in Backend Responsibility:** The `apps/ml` service now takes over the responsibility for medicine verification, moving away from the previously unavailable Node API. This centralizes ML-driven logic within its dedicated microservice, aligning with our microservice architecture principles.
- **Increased Importance of ML Service:** The `apps/ml` service is no longer just for optional features like ASR or OCR; it is now a `required` component for a core user-facing feature. Its availability and performance are paramount for the SahiDawa platform's primary function.
- **Pattern for Future ML Features:** This implementation sets a clear pattern for integrating future ML-driven verification or analysis features into the platform, leveraging FastAPI, Pydantic, and efficient data handling for robust API development.
- **Data Dependency:** The feature introduces a direct dependency on the `data/seeds/medicines.csv` file. Maintaining the accuracy and freshness of this dataset is now crucial for the reliability of the verification system.
- **Frontend Integration Point:** While the frontend changes were not part of this PR's diff, the new `POST /verify/batch` endpoint provides the necessary API for the `apps/web` scanner UI to consume. This completes the end-to-end user journey for medicine verification, making the platform truly functional in this regard.

## Testing & Verification

The changes introduced in this PR were thoroughly tested to ensure the reliability and correctness of the medicine batch verification endpoint.

- **Unit Tests (`apps/ml/tests/test_verify.py`):**
    - `test_health`: Verified the basic operational status of the ML service.
    - `test_valid_medicine (DL23X1)`: Confirmed that a known valid batch number correctly returns a "valid" status and associated medicine details.
    - `test_counterfeit_medicine (DL23X9)`: Confirmed that a batch number flagged as counterfeit correctly returns a "recalled" status and `is_counterfeit_alert` as `True`.
    - `test_not_found (FAKE999)`: Verified that an unknown batch number correctly returns a "not_found" status.
    - `test_missing_batch_number`: Ensured that FastAPI's Pydantic validation correctly catches requests with missing required fields, returning a `422 Unprocessable Entity` status.
- **Manual Testing:**
    - **Swagger UI:** The endpoint was manually tested via the auto-generated Swagger UI at `localhost:8000/docs`, allowing direct interaction with the API and inspection of request/response payloads.
    - **Live Scanner UI:** The full end-to-end flow was tested using the SahiDawa scanner UI at `localhost:3000/en/scan`. This involved entering specific batch numbers (e.g., `DL23X1` for valid, `DL23X9` for recalled) and observing the correct display of green (verified), red (counterfeit/recalled), and amber (unverified/not found) result cards, as depicted in the PR screenshots.
- **Edge Cases Handled (Implicitly/Code-level):**
    - **Database Unavailability:** The code explicitly handles the scenario where `medicines.csv` cannot be loaded by raising an `HTTPException` with a `503 Service Unavailable` status, preventing service crashes.
    - **Invalid Expiry Date Format:** The `try-except` block around `pd.to_datetime(row["expiry_date"])` ensures that malformed or unparseable expiry dates do not cause the service to fail, gracefully defaulting `is_expired` to `False` in such cases.
    - **Case-Insensitivity:** Batch number matching is case-insensitive, making the system robust to variations in user input.
