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

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Authorization: `Basic ${credentials}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const errText = await response.text();
                logger.error(`Twilio SMS API error: ${response.status} ${errText}`);
                return false;
            }

            logger.info(`Twilio SMS sent successfully to ${phone}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send SMS to ${phone} via Twilio`, { error });
            return false;
        }
    }
}

export const smsService = new TwilioSMSService();
