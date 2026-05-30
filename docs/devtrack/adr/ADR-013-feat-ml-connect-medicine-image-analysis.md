# ADR — feat(ml): connect medicine image analysis

> **Date:** 2026-05-29 | **PR:** #845 | **Status:** Accepted

## Context

The SahiDawa platform required a new capability to analyze images of medicine packaging to identify potentially fake or suspicious products. This functionality needed to be integrated into the existing reporting workflow, where users upload images, to provide immediate feedback on the authenticity of medicines. The core challenge was how to expose a new machine learning (ML) service, developed in Python, to the existing Node.js API Gateway and web application securely, reliably, and with appropriate data validation.

## Decision

A new, dedicated ML microservice was implemented using FastAPI (`apps/ml`) to perform medicine image analysis, accepting a Cloudinary image URL and returning a verdict and confidence score. To integrate this, the existing Node.js API Gateway (`apps/api`) was extended with a new Express router (`/api/ml`) that acts as a proxy to the FastAPI ML service. This proxy endpoint, `/api/ml/analyze`, performs critical functions:
1.  **Request Validation:** Uses Zod to validate incoming `imageUrl` parameters, ensuring they are valid HTTPS URLs.
2.  **ML Service Proxying:** Forwards validated requests to the internal FastAPI ML service.
3.  **Timeout Handling:** Implements an 8-second timeout using `AbortController` to prevent indefinite waits for ML analysis.
4.  **Response Validation:** Uses Zod to validate the structure and content of responses received from the ML service.
5.  **Error Handling:** Provides consistent error responses for invalid input, ML service failures, and timeouts.

Finally, the web application's Report Wizard (`apps/web`) was updated to send uploaded medicine packaging image URLs to this new `/api/ml/analyze` endpoint and display the returned verdict and confidence to the user.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Direct client-to-ML service communication | Exposing the ML service directly to the client would bypass the API Gateway's centralized security, authentication, and rate limiting. It would also complicate client-side error handling, require clients to manage ML service URLs, and prevent server-side input/output validation, leading to potential security vulnerabilities and inconsistent data. |
| Integrate ML logic directly into the existing Express API | The ML logic is Python-based, while the API Gateway is Node.js. Integrating Python code directly into a Node.js application is complex, non-idiomatic, and creates a monolithic service with mixed technology stacks. This would hinder independent scaling of the computationally intensive ML component and complicate maintenance and deployment for both teams. |

## Consequences

**Positive:**
- Enabled a critical new feature for medicine verification, enhancing the platform's core value proposition.
- Decoupled the computationally intensive ML logic into a separate, independently scalable microservice, improving system resilience and performance.
- Centralized request and response validation, error handling, and timeout management for ML interactions within the API Gateway, ensuring data integrity and consistent API behavior.
- Provided immediate, actionable feedback to users during the reporting process, improving user experience and data quality.

**Trade-offs:**
- Introduced an additional service (FastAPI ML service) into the architecture, increasing operational overhead for deployment, monitoring, and maintenance.
- Added network latency due to the proxy layer between the API Gateway and the ML service.
- Increased overall system complexity with the introduction of a new microservice and inter-service communication patterns.

## Related Issues & PRs

- PR #845: feat(ml): connect medicine image analysis
- Issue #587