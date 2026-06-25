import logger from "../utils/logger";

export interface SMSProvider {
    send(phone: string, message: string, language: string): Promise<boolean>;
}

export class TwilioSMSService implements SMSProvider {
    private accountSid = process.env.TWILIO_ACCOUNT_SID;
    private authToken = process.env.TWILIO_AUTH_TOKEN;
    private fromNumber = process.env.TWILIO_PHONE_NUMBER;

    async send(phone: string, message: string, language: string): Promise<boolean> {
        logger.info(`[SMS][${language}] Preparing to send to ${phone}: "${message}"`);

        if (!this.accountSid || !this.authToken || !this.fromNumber) {
            logger.warn(`Twilio credentials missing. MOCKING SMS delivery to ${phone}.`);
            return true;
        }

        try {
            const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
            const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
                "base64"
            );

            const params = new URLSearchParams();
            params.append("To", phone);
            params.append("From", this.fromNumber);
            params.append("Body", message);

            const maxRetries = 4;
            let retryDelay = 1000; // Start with 1 second

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: params.toString(),
                });

                // Success case
                if (response.ok) {
                    logger.info(`Twilio SMS sent successfully to ${phone}`);
                    return true;
                }

                // Retry only for rate-limit errors (HTTP 429)
                if (response.status === 429) {
                    // If we've exhausted all retries, log and fail gracefully
                    if (attempt === maxRetries) {
                        const errText = await response.text();

                        logger.error(
                            `Twilio SMS failed after ${maxRetries} retries due to rate limiting: ${errText}`
                        );

                        return false;
                    }

                    logger.warn(
                        `Twilio rate limit hit for ${phone}. Retrying in ${retryDelay}ms (attempt ${
                            attempt + 1
                        }/${maxRetries})`
                    );

                    // Non-blocking async delay
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));

                    // Exponential backoff: 1s -> 2s -> 4s -> 8s
                    retryDelay *= 2;

                    continue;
                
                }

                // Existing behavior for all non-429 errors
                const errText = await response.text();
                logger.error(`Twilio SMS API error: ${response.status} ${errText}`);
                return false;
            }

            return false;
       } catch (error) {
            logger.error(`Failed to send SMS to ${phone} via Twilio`, { error });
            return false;
        }
    }
}

export const smsService = new TwilioSMSService();
