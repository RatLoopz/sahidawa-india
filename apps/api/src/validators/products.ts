/**
 * Product Validation Middleware
 * Validates product create/update payloads
 */

import { Request, Response, NextFunction } from 'express';

export function validateProductCreate(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { title, price, category } = req.body;

    const errors: string[] = [];

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
        errors.push('Title is required and must be at least 3 characters');
    }

    // Validate price
    if (!price || typeof price !== 'number' || price <= 0) {
        errors.push('Price is required and must be greater than 0');
    }

    // Validate category
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
        errors.push('Category is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    next();
}

export function validateProductUpdate(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { title, price, category, stock, is_active } = req.body;

    const errors: string[] = [];

    // Validate title if provided
    if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length < 3) {
            errors.push('Title must be at least 3 characters');
        }
    }

    // Validate price if provided
    if (price !== undefined) {
        if (typeof price !== 'number' || price <= 0) {
            errors.push('Price must be greater than 0');
        }
    }

    // Validate category if provided
    if (category !== undefined) {
        if (typeof category !== 'string' || category.trim().length === 0) {
            errors.push('Category must not be empty');
        }
    }

    // Validate stock if provided
    if (stock !== undefined) {
        if (typeof stock !== 'number' || stock < 0) {
            errors.push('Stock must be a non-negative number');
        }
    }

    // Validate is_active if provided
    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
            errors.push('is_active must be a boolean');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    next();
}
