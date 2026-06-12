import { supabase, dbConfig } from "../db/client";
import { smsService } from "../services/sms-service";
import { whatsappService } from "../services/whatsapp-service";
import logger from "../utils/logger";

let intervalId: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = process.env.NODE_ENV === "test" ? 1000 : 30000; // 30 seconds

export function getLocalizedMessage(
    type: "counterfeit" | "recall" | "expiry",
    data: { medicineName: string; batchNumber?: string; district?: string; expiryDate?: string },
    language: string
): { title: string; body: string } {
    const lang = language.toLowerCase();

    const templates: Record<string, Record<string, string>> = {
        counterfeit: {
            en: "🚨 Fake Medicine Alert in {district}: Multiple counterfeit reports of {medicineName} have been verified. Please inspect your packaging carefully.",
            hi: "🚨 {district} में नकली दवा अलर्ट: {medicineName} की कई नकली रिपोर्ट सत्यापित की गई हैं। कृपया अपनी पैकिंग की सावधानीपूर्वक जांच करें।",
            ta: "🚨 {district} இல் போலி மருந்து எச்சரிக்கை: {medicineName} இன் பல போலி அறிக்கைகள் சரிபார்க்கப்பட்டுள்ளன. உங்கள் பேக்கேஜிங்கை கவனமாக சரிபார்க்கவும்.",
            te: "🚨 {district} లో నకిలీ మందుల హెచ్చరిక: {medicineName} యొక్క అనేక నకిలీ నివేదికలు ధృవీకరించబడ్డాయి. దయచేసి మీ ప్యాకేజింగ్ జాగ్రత్తగా తనిఖీ చేయండి.",
            bn: "🚨 {district}-এ নকল ওষুধের সতর্কতা: {medicineName}-এর একাধিক নকল প্রতিবেদন যাচাই করা হয়েছে। আপনার প্যাকেজিং সাবধানে পরীক্ষা করুন।",
            mr: "🚨 {district} मध्ये बनावट औषध इशारा: {medicineName} च्या अनेक बनावट अहवालांची पडताळणी झाली आहे. कृपया तुमचे पॅकेजिंग काळजीपूर्वक तपासा.",
        },
        recall: {
            en: "🚨 Medicine Recall Alert: {medicineName} (Batch: {batchNumber}) has been flagged as substandard or recalled by CDSCO. Stop consumption immediately.",
            hi: "🚨 दवा वापसी अलर्ट: {medicineName} (बैच: {batchNumber}) को CDSCO द्वारा घटिया या वापस लेने योग्य घोषित किया गया है। तुरंत सेवन बंद करें।",
            ta: "🚨 மருந்து திரும்பப் பெறும் எச்சரிக்கை: {medicineName} (தொகுதி: {batchNumber}) தரமற்றது என CDSCO ஆல் அடையாளம் காணப்பட்டுள்ளது. உடனடியாகப் பயன்படுத்துவதை நிறுத்தவும்.",
            te: "🚨 మందుల ఉపసంహరణ హెచ్చరిక: {medicineName} (బ్యాంచ్: {batchNumber}) నాణ్యత లేనిదిగా CDSCO గుర్తించింది. వెంటనే వాడటం ఆపివేయండి.",
            bn: "🚨 ওষুধ প্রত্যাহারের সতর্কতা: {medicineName} (ব্যাচ: {batchNumber}) CDSCO দ্বারা নিম্নমানের বা প্রত্যাহার করা হয়েছে। অবিলম্বে ব্যবহার বন্ধ করুন।",
            mr: "🚨 औषध माघारीचा इशारा: {medicineName} (बॅच: {batchNumber}) CDSCO द्वारे निकृष्ट दर्जाचे घोषित करून मागे घेण्यात आले आहे. ताबडतोब वापर थांबवा.",
        },
        expiry: {
            en: "⚠️ Medicine Expiry Warning: Batch {batchNumber} of {medicineName} is expiring soon (Expiry: {expiryDate}). Check your stock.",
            hi: "⚠️ दवा समाप्ति चेतावनी: {medicineName} का बैच {batchNumber} जल्द ही समाप्त हो रहा है (समाप्ति तिथि: {expiryDate})। अपने स्टॉक की जांच करें।",
            ta: "⚠️ மருந்து காலാവதி எச்சரிக்கை: {medicineName} இன் தொகுதி {batchNumber} விரைவில் കാലാവതിയായി കൊണ്ടിരിക്കുന്നു (காலாவதி: {expiryDate}). உங்கள் இருப்பை சரிபார்க்கவும்.",
            te: "⚠️ మందుల గడువు హెచ్చరిక: {medicineName} యొక్క బ్యాంచ్ {batchNumber} త్వరలో ముగియనుంది (గడువు: {expiryDate}). మీ నిల్వను తనిఖీ చేయండి.",
            bn: "⚠️ ওষুধ মেয়াদের সতর্কতা: {medicineName}-এর ব্যাচ {batchNumber} শীঘ্রই মেয়াদ শেষ হচ্ছে (মেয়াদ: {expiryDate})। আপনার স্টক পরীক্ষা করুন।",
            mr: "⚠️ औषध कालबाह्य इशारा: {medicineName} ची बॅच {batchNumber} लवकरच कालबाह्य होत आहे (कालबाह्यता: {expiryDate})। तुमचा साठा तपासा.",
        },
    };

    const category = templates[type] || templates.recall;
    const template = category[lang] || category.en;

    const body = template
        .replace(/{medicineName}/g, data.medicineName || "Medicine")
        .replace(/{batchNumber}/g, data.batchNumber || "Unknown")
        .replace(/{district}/g, data.district || "your district")
        .replace(/{expiryDate}/g, data.expiryDate || "soon");

    const titleMatch = body.match(/^(.*?):/);
    const title = titleMatch ? titleMatch[1] : "SahiDawa Alert";

    return { title, body };
}

async function sendNotificationToSubscriber(
    sub: any,
    type: "counterfeit" | "recall" | "expiry",
    data: any
): Promise<void> {
    const { title, body } = getLocalizedMessage(type, data, sub.language);
    const fullMessage = `${title}\n\n${body}`;

    const sendPromises: Promise<boolean>[] = [];
    if (sub.channels.includes("sms")) {
        sendPromises.push(smsService.send(sub.phone, fullMessage, sub.language));
    }
    if (sub.channels.includes("whatsapp")) {
        sendPromises.push(whatsappService.send(sub.phone, fullMessage, sub.language));
    }

    await Promise.all(sendPromises);
}

export async function broadcastDistrictAlerts(): Promise<void> {
    try {
        const { data: alerts, error: alertsError } = await supabase
            .from("district_alerts")
            .select("*")
            .eq("broadcasted", false)
            .eq("is_active", true);

        if (alertsError) {
            logger.error({
                message: "Failed to fetch unbroadcasted district alerts",
                error: alertsError,
            });
            return;
        }

        if (!alerts || alerts.length === 0) return;

        for (const alert of alerts) {
            logger.info(`Broadcasting counterfeit alert for district: ${alert.district}`);

            const { data: subscribers, error: subsError } = await supabase
                .from("notification_subscribers")
                .select("*")
                .eq("is_active", true)
                .ilike("district", alert.district);

            if (subsError) {
                logger.error({
                    message: "Failed to fetch subscribers for district alert",
                    error: subsError,
                });
                continue;
            }

            if (subscribers && subscribers.length > 0) {
                for (const sub of subscribers) {
                    await sendNotificationToSubscriber(sub, "counterfeit", {
                        medicineName: alert.medicine_name,
                        district: alert.district,
                    });
                }
            }

            await supabase.from("district_alerts").update({ broadcasted: true }).eq("id", alert.id);
        }
    } catch (err) {
        logger.error({ message: "Error in broadcastDistrictAlerts", error: err });
    }
}

export async function broadcastDrugAlerts(): Promise<void> {
    try {
        const { data: alerts, error: alertsError } = await supabase
            .from("drug_alerts")
            .select("*")
            .eq("broadcasted", false);

        if (alertsError) {
            logger.error({
                message: "Failed to fetch unbroadcasted drug alerts",
                error: alertsError,
            });
            return;
        }

        if (!alerts || alerts.length === 0) return;

        for (const alert of alerts) {
            logger.info(`Broadcasting CDSCO drug recall: ${alert.reported_brand_name}`);

            let query = supabase.from("notification_subscribers").select("*").eq("is_active", true);

            if (alert.district) {
                query = query.ilike("district", alert.district);
            }

            const { data: subscribers, error: subsError } = await query;

            if (subsError) {
                logger.error({
                    message: "Failed to fetch subscribers for drug alert",
                    error: subsError,
                });
                continue;
            }

            if (subscribers && subscribers.length > 0) {
                for (const sub of subscribers) {
                    await sendNotificationToSubscriber(sub, "recall", {
                        medicineName: alert.reported_brand_name,
                        batchNumber: alert.batch_number,
                    });
                }
            }

            await supabase.from("drug_alerts").update({ broadcasted: true }).eq("id", alert.id);
        }
    } catch (err) {
        logger.error({ message: "Error in broadcastDrugAlerts", error: err });
    }
}

export async function broadcastExpiryAlerts(): Promise<void> {
    try {
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];

        const { data: expiringBatches, error: batchesError } = await supabase
            .from("batches")
            .select("*, medicine:medicines(brand_name)")
            .lte("expiry_date", thirtyDaysFromNow)
            .eq("expiry_broadcasted", false);

        if (batchesError) {
            logger.error({ message: "Failed to fetch expiring batches", error: batchesError });
            return;
        }

        if (!expiringBatches || expiringBatches.length === 0) return;

        for (const batch of expiringBatches) {
            logger.info(`Broadcasting medicine expiry warning for batch: ${batch.batch_number}`);

            // Broadcast to all active subscribers
            const { data: subscribers, error: subsError } = await supabase
                .from("notification_subscribers")
                .select("*")
                .eq("is_active", true);

            if (subsError) {
                logger.error({
                    message: "Failed to fetch subscribers for expiry alert",
                    error: subsError,
                });
                continue;
            }

            if (subscribers && subscribers.length > 0) {
                const medicineName = batch.medicine?.brand_name || "Unknown Medicine";
                for (const sub of subscribers) {
                    await sendNotificationToSubscriber(sub, "expiry", {
                        medicineName,
                        batchNumber: batch.batch_number,
                        expiryDate: batch.expiry_date,
                    });
                }
            }

            await supabase.from("batches").update({ expiry_broadcasted: true }).eq("id", batch.id);
        }
    } catch (err) {
        logger.error({ message: "Error in broadcastExpiryAlerts", error: err });
    }
}

export async function checkAndBroadcastAll(): Promise<void> {
    if (dbConfig?.isSupabaseOffline) {
        logger.debug("Supabase database is offline. Skipping cron alert broadcasting.");
        return;
    }
    await broadcastDistrictAlerts();
    await broadcastDrugAlerts();
    await broadcastExpiryAlerts();
}

export function startAlertBroadcaster(): void {
    if (intervalId) {
        logger.warn("Alert broadcaster is already running.");
        return;
    }

    logger.info(`Starting Alert Broadcaster periodic loop (interval: ${CHECK_INTERVAL_MS}ms)`);

    // Run initial execution after a short delay
    setTimeout(() => {
        void checkAndBroadcastAll();
    }, 2000);

    intervalId = setInterval(() => {
        void checkAndBroadcastAll();
    }, CHECK_INTERVAL_MS);
}

export function stopAlertBroadcaster(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info("Stopped Alert Broadcaster periodic loop");
    }
}
