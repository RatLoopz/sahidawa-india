import { Router, Response } from "express";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";
import { scheduleLimiter } from "../middleware/rateLimit";
import { HttpError, medicineScheduleService } from "../services/medicineSchedule.service";

const router = Router();
router.use(scheduleLimiter);

/**
 * Maps an error thrown by the service layer to an HTTP response. Expected
 * failures are raised as HttpError (with the status/message/details the client
 * should see); anything else is logged and surfaced as a generic 500.
 */
const respondWithError = (
    res: Response,
    err: unknown,
    logMessage: string,
    logMeta: Record<string, unknown> = {}
) => {
    if (err instanceof HttpError) {
        const body: Record<string, unknown> = { error: err.message };
        if (err.details !== undefined) body.details = err.details;
        res.status(err.status).json(body);
        return;
    }
    logger.error(logMessage, { error: err, ...logMeta });
    res.status(500).json({ error: "An unexpected error occurred" });
};

// List user's active schedules
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(await medicineScheduleService.listSchedules(req.user!.id));
    } catch (err) {
        respondWithError(res, err, "Error listing schedules");
    }
});

// Get single schedule by id
router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(await medicineScheduleService.getSchedule(String(req.params.id), req.user!.id));
    } catch (err) {
        respondWithError(res, err, "Error fetching schedule", { scheduleId: req.params.id });
    }
});

// Create schedule
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const result = await medicineScheduleService.createSchedule(req.body, req.user!.id);
        res.status(201).json(result);
    } catch (err) {
        respondWithError(res, err, "Error creating schedule");
    }
});

// Update schedule
router.put("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(
            await medicineScheduleService.updateSchedule(
                String(req.params.id),
                req.body,
                req.user!.id
            )
        );
    } catch (err) {
        respondWithError(res, err, "Error updating schedule", { scheduleId: req.params.id });
    }
});

// Delete schedule
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(await medicineScheduleService.deleteSchedule(String(req.params.id), req.user!.id));
    } catch (err) {
        respondWithError(res, err, "Error deleting schedule", { scheduleId: req.params.id });
    }
});

// Log a dose (taken/skipped) - upsert to handle re-marking
router.post("/:id/doses", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(
            await medicineScheduleService.logDose(String(req.params.id), req.body, req.user!.id)
        );
    } catch (err) {
        respondWithError(res, err, "Error logging dose", { scheduleId: req.params.id });
    }
});

// Get dose logs for a schedule
router.get("/:id/doses", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(await medicineScheduleService.listDoseLogs(String(req.params.id), req.user!.id));
    } catch (err) {
        respondWithError(res, err, "Error fetching dose logs", { scheduleId: req.params.id });
    }
});

// Get adherence statistics for a schedule
router.get("/:id/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(
            await medicineScheduleService.getStats(String(req.params.id), req.query, req.user!.id)
        );
    } catch (err) {
        respondWithError(res, err, "Error fetching adherence stats", {
            scheduleId: req.params.id,
        });
    }
});

// Get today's pending doses for all user's active schedules
router.get("/today/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(await medicineScheduleService.getTodaySummary(req.query, req.user!.id));
    } catch (err) {
        respondWithError(res, err, "Error fetching today's summary");
    }
});

export default router;
