import { Worker } from "bullmq";
import logger from "../utils/logger";

new Worker(
    "sms-queue",
    async (job) => {
        const { phone, message, language } = job.data;

        logger.info(`[SMS][${language}] Processing job for ${phone}`);

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            logger.warn(`Twilio credentials missing. MOCKING SMS delivery to ${phone}.`);
            return;
        }

        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

        const params = new URLSearchParams();
        params.append("To", phone);
        params.append("From", fromNumber);
        params.append("Body", message);

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        });

        if (response.ok) {
            logger.info(`Twilio SMS sent successfully to ${phone}`);
            return;
        }

        if (response.status === 429) {
            throw new Error("Twilio rate limited");
        }

        const errText = await response.text();
        throw new Error(`Twilio SMS API error: ${response.status} ${errText}`);
    },
    {
        connection: {
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: Number(process.env.REDIS_PORT || 6379),
        },
    }
);

logger.info("SMS Worker started");
