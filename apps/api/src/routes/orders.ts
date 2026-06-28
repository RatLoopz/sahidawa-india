/**
 * Orders API Routes
 * Implements marketplace order management with status tracking
 * Fixes issue #2735: Missing order tracking visibility for buyers
 */

import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { validateOrderStatusUpdate } from '../validators/orders';

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/orders
 * Fetch orders for authenticated user (buyer or seller perspective)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { role = 'buyer', skip = 0, limit = 20, status } = req.query;

        let query = supabase
            .from('orders')
            .select(
                '*, order_items(id, product_id, quantity, unit_price, total_price), order_status_history(old_status, new_status, changed_at)'
            )
            .order('created_at', { ascending: false });

        // Filter based on user role
        if (role === 'seller') {
            query = query.eq('seller_id', userId);
        } else {
            query = query.eq('buyer_id', userId);
        }

        // Filter by status if provided
        if (status) {
            query = query.eq('status', status);
        }

        // Pagination
        const { data: orders, error } = await query.range(
            Number(skip),
            Number(skip) + Number(limit) - 1
        );

        if (error) throw error;

        res.json({ orders: orders || [], total: orders?.length || 0 });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

/**
 * GET /api/orders/:orderId
 * Fetch a single order with full details and status history
 */
router.get('/:orderId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const userId = req.user!.id;

        const { data: order, error } = await supabase
            .from('orders')
            .select(
                '*, order_items(id, product_id, quantity, unit_price, total_price, products(title, image_url)), order_status_history(old_status, new_status, changed_at, changed_by)'
            )
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verify user has access to this order
        if (order.buyer_id !== userId && order.seller_id !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json({ order });
    } catch (err) {
        console.error('Error fetching order:', err);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

/**
 * PATCH /api/orders/:orderId/status
 * Update order status with validation and notifications
 * Only sellers can update status
 */
router.patch(
    '/:orderId/status',
    requireAuth,
    validateOrderStatusUpdate,
    async (req: Request, res: Response) => {
        try {
            const { orderId } = req.params;
            const { status, tracking_number, courier_name } = req.body;
            const seller_id = req.user!.id;

            // Fetch current order to verify ownership
            const { data: order, error: fetchError } = await supabase
                .from('orders')
                .select('id, seller_id, status, buyer_id')
                .eq('id', orderId)
                .single();

            if (fetchError || !order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // Verify seller owns this order
            if (order.seller_id !== seller_id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Only the seller can update this order',
                });
            }

            // Update order status
            const { data: updatedOrder, error: updateError } = await supabase
                .from('orders')
                .update({
                    status,
                    tracking_number: tracking_number || order.tracking_number,
                    courier_name: courier_name || order.courier_name,
                    status_updated_at: new Date().toISOString(),
                })
                .eq('id', orderId)
                .select()
                .single();

            if (updateError) throw updateError;

            // Send notification email if shipped
            if (status === 'shipped' && order.buyer_id) {
                await sendShippedNotification(order.buyer_id, updatedOrder);
            }

            res.json({
                message: 'Order status updated successfully',
                order: updatedOrder,
            });
        } catch (err) {
            console.error('Error updating order status:', err);
            res.status(500).json({ error: 'Failed to update order status' });
        }
    }
);

/**
 * Helper: Send notification email when order is shipped
 * In production, this would call a mail service or trigger an Edge Function
 */
async function sendShippedNotification(buyerId: string, order: any) {
    try {
        // Get buyer email
        const { data: user } = await supabase.auth.admin.getUserById(buyerId);

        if (user?.email) {
            // In production, call sendgrid, mailgun, or Supabase Edge Function
            console.log(
                `Notification sent: Order ${order.order_display_id} shipped to ${user.email}`
            );
            console.log(
                `Tracking: ${order.courier_name} - ${order.tracking_number}`
            );
        }
    } catch (err) {
        console.error('Error sending notification:', err);
        // Don't fail the order update if notification fails
    }
}

/**
 * GET /api/orders/:orderId/timeline
 * Fetch order status timeline for display
 */
router.get('/:orderId/timeline', requireAuth, async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const userId = req.user!.id;

        // Verify access
        const { data: order } = await supabase
            .from('orders')
            .select('buyer_id, seller_id')
            .eq('id', orderId)
            .single();

        if (
            !order ||
            (order.buyer_id !== userId && order.seller_id !== userId)
        ) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Fetch full status history
        const { data: history, error } = await supabase
            .from('order_status_history')
            .select('*')
            .eq('order_id', orderId)
            .order('changed_at', { ascending: true });

        if (error) throw error;

        // Format timeline
        const timeline = formatTimeline(history || []);

        res.json({ timeline });
    } catch (err) {
        console.error('Error fetching timeline:', err);
        res.status(500).json({ error: 'Failed to fetch timeline' });
    }
});

/**
 * Helper: Format status history into timeline
 */
function formatTimeline(history: any[]) {
    const statuses = ['placed', 'confirmed', 'shipped', 'delivered'];

    return statuses.map((status) => {
        const entry = history.find((h) => h.new_status === status);
        return {
            status,
            completed: !!entry,
            timestamp: entry?.changed_at || null,
            label: formatStatusLabel(status),
        };
    });
}

/**
 * Helper: Format status label for display
 */
function formatStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        placed: 'Order Placed',
        confirmed: 'Order Confirmed',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
    };
    return labels[status] || status;
}

export default router;
