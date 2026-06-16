import logger from "../utils/logger";

export interface WhatsAppProvider {
    send(phone: string, message: string, language: string): Promise<boolean>;
}

export class GupshupWhatsAppService implements WhatsAppProvider {
    private apiKey = process.env.GUPSHUP_API_KEY;
    private sourceNumber = process.env.GUPSHUP_SOURCE_NUMBER;

    async send(phone: string, message: string, language: string): Promise<boolean> {
        logger.info(`[WhatsApp][${language}] Preparing to send to ${phone}: "${message}"`);

        if (!this.apiKey || !this.sourceNumber) {
            logger.warn(`Gupshup credentials missing. MOCKING WhatsApp delivery to ${phone}.`);
            return true;
        }

        try {
            const endpoint = "https://api.gupshup.io/sm/api/v1/msg";

            const params = new URLSearchParams();
            params.append("channel", "whatsapp");
            params.append("source", this.sourceNumber);
            params.append("destination", phone);
            params.append(
                "message",
                JSON.stringify({
                    type: "text",
                    text: message,
                })
            );

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    apikey: this.apiKey,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const errText = await response.text();
                logger.error(`Gupshup WhatsApp API error: ${response.status} ${errText}`);
                return false;
            }

            logger.info(`Gupshup WhatsApp sent successfully to ${phone}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send WhatsApp to ${phone} via Gupshup`, { error });
            return false;
        }
    }
}

export const whatsappService = new GupshupWhatsAppService();
