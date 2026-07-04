import logger from "../utils/logger";
import { smsQueue } from "../queues/smsQueue";
export interface SMSProvider {
    send(phone: string, message: string, language: string): Promise<boolean>;
    sendOtp(phone: string, otp: string, language: string): Promise<boolean>;
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

    async sendOtp(phone: string, otp: string, language: string): Promise<boolean> {
        // Can be easily extended with i18n/language-specific templates here or migrated to Twilio Verify
        const message = `Your SahiDawa alert registration OTP is: ${otp}. It will expire in 10 minutes.`;
        return this.send(phone, message, language);
    }
}

export const smsService = new TwilioSMSService();
