import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SahiDawa API",
      version: "1.0.0",
      description:
        "India's First Open-Source Citizen Medicine Verifier & Rural Health Bridge — REST API Documentation",
      contact: {
        name: "SahiDawa Contributors",
        url: "https://github.com/RatLoopz/sahidawa-india",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local Development Server",
      },
    ],
    components: {
      schemas: {
        Medicine: {
          type: "object",
          properties: {
            brand_name: { type: "string", example: "Dolo 650" },
            generic_name: { type: "string", example: "Paracetamol" },
            manufacturer: { type: "string", example: "Micro Labs Ltd" },
            batch_number: { type: "string", example: "BN2024001" },
            expiry_date: { type: "string", format: "date", example: "2026-12-31" },
            cdsco_approval_status: {
              type: "string",
              enum: ["approved", "recalled", "banned"],
              example: "approved",
            },
            is_counterfeit_alert: { type: "boolean", example: false },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Invalid request body" },
            details: { type: "array", items: { type: "object" } },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            db: { type: "string", example: "connected" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/app.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);