import logger from "../utils/logger";
import { smsQueue } from "../queues/smsQueue";
export interface SMSProvider {
    send(phone: string, message: string, language: string): Promise<boolean>;
}

export class TwilioSMSService implements SMSProvider {
    async send(phone: string, message: string, language: string): Promise<boolean> {
        logger.info(`[SMS][${language}] Queueing SMS for ${phone}`);

        try {
            await smsQueue.add(
                "send-sms",
                {
                    phone,
                    message,
                    language,
                },
                {
                    attempts: 5,
                    backoff: {
                        type: "exponential",
                        delay: 1000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                }
            );

            return true;
        } catch (error) {
            logger.error("Failed to enqueue SMS job", { error });
            return false;
        }
    }
}

export const smsService = new TwilioSMSService();
