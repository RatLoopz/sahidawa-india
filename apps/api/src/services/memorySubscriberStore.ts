import logger from "../utils/logger";
import { supabase, dbConfig } from "../db/client";

export interface InMemorySubscriber {
    id: string;
    user_id: string | null;
    phone: string;
    channels: ("sms" | "whatsapp")[];
    language: string;
    district: string;
    is_active: boolean;
    status: string;
    created_at: string;
    updated_at: string;
}

class PersistedMemorySubscriberStore {
    private store = new Map<string, InMemorySubscriber>();
    private isReconciling = false;

    constructor() {
        this.startReconciliation();
    }

    get(phone: string): InMemorySubscriber | undefined {
        return this.store.get(phone);
    }

    set(phone: string, subscriber: InMemorySubscriber): void {
        this.store.set(phone, subscriber);
    }

    delete(phone: string): boolean {
        return this.store.delete(phone);
    }

    find(predicate: (sub: InMemorySubscriber) => boolean): InMemorySubscriber | undefined {
        for (const sub of this.store.values()) {
            if (predicate(sub)) return sub;
        }
        return undefined;
    }

    values(): IterableIterator<InMemorySubscriber> {
        return this.store.values();
    }

    size(): number {
        return this.store.size;
    }

    clear(): void {
        this.store.clear();
    }

    getAll(): InMemorySubscriber[] {
        return Array.from(this.store.values());
    }

    async reconcileWithSupabase(): Promise<void> {
        const subscribers = this.getAll();
        if (subscribers.length === 0) return;

        logger.info(`Attempting to reconcile ${subscribers.length} subscribers to Supabase...`);

        let reconciled = 0;
        let failed = 0;

        for (const sub of subscribers) {
            try {
                const { data: existing } = await supabase
                    .from("notification_subscribers")
                    .select("id")
                    .eq("phone", sub.phone)
                    .maybeSingle();

                const payload = {
                    user_id: sub.user_id,
                    phone: sub.phone,
                    channels: sub.channels,
                    language: sub.language,
                    district: sub.district,
                    is_active: sub.is_active,
                    status: sub.status,
                };

                let error;
                if (existing) {
                    const { error: updateError } = await supabase
                        .from("notification_subscribers")
                        .update(payload)
                        .eq("id", existing.id);
                    error = updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from("notification_subscribers")
                        .insert(payload);
                    error = insertError;
                }

                if (error) {
                    logger.warn({
                        message: `Failed to reconcile subscriber ${sub.phone}`,
                        error,
                    });
                    failed++;
                } else {
                    reconciled++;
                    this.store.delete(sub.phone);
                }
            } catch (err) {
                logger.warn({
                    message: `Exception reconciling subscriber ${sub.phone}`,
                    error: err,
                });
                failed++;
            }
        }

        if (reconciled > 0) {
            logger.info(`Reconciled ${reconciled} subscribers to Supabase, ${failed} failed`);
        }
    }

    private startReconciliation(): void {
        setInterval(async () => {
            if (this.isReconciling) return;
            if (!dbConfig?.isSupabaseOffline && this.store.size > 0) {
                this.isReconciling = true;
                try {
                    await this.reconcileWithSupabase();
                } finally {
                    this.isReconciling = false;
                }
            }
        }, 30_000);
    }
}

export const memorySubscriberStore = new PersistedMemorySubscriberStore();
