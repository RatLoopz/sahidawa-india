/**
 * Order Validation Middleware
 * Validates order create/update payloads
 */

import { Request, Response, NextFunction } from 'express';

export function validateOrderStatusUpdate(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { status, tracking_number, courier_name } = req.body;

    const errors: string[] = [];

    // Validate status
    const validStatuses = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
        errors.push(
            `Status must be one of: ${validStatuses.join(', ')}`
        );
    }

    // Validate tracking_number if provided
    if (tracking_number !== undefined && typeof tracking_number !== 'string') {
        errors.push('Tracking number must be a string');
    }

    // Validate courier_name if provided
    if (courier_name !== undefined && typeof courier_name !== 'string') {
        errors.push('Courier name must be a string');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    next();
}
