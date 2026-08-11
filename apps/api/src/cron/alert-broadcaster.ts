import { supabase, dbConfig } from "../db/client";
import { smsService } from "../services/sms-service";
import { whatsappService } from "../services/whatsapp-service";
import logger from "../utils/logger";
import { NotificationSubscriber, NotificationAlertData } from "../types/notification.types";
import { redisClient } from "../utils/redis";

let intervalId: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = process.env.NODE_ENV === "test" ? 1000 : 30000; // 30 seconds
const PAGE_SIZE = 1000;
const NOTIFICATION_CHUNK_SIZE = 50;
const LOCK_KEY = "alert-broadcaster:lock";
const LOCK_TTL_MS = 25_000; // 25s TTL, replenished by renewLock() so it outlives long runs
// Heartbeat cadence is well under the TTL so a busy RPC/sms/whatsapp provider
// call can never let the distributed lock expire mid-broadcast.
const LOCK_RENEW_INTERVAL_MS = process.env.NODE_ENV === "test" ? 50 : Math.floor(LOCK_TTL_MS / 2);
const LOCK_VALUE = `${process.env.HOSTNAME ?? "api"}:${process.pid}`;

// In-process run guard: without it a single instance can overlap its own ticks
// when a broadcast run outlives the 30s scheduler interval and the distributed
// lock has already expired mid-run.
let isBroadcasting = false;

export const broadcastConfig = {
    MARK_BROADCASTED_CHUNK_SIZE: 500,
};

export type AlertFrequency = "immediate" | "daily" | "weekly" | "monthly";

const FREQUENCIES: AlertFrequency[] = ["immediate", "daily", "weekly", "monthly"];

// Daily digests are only attempted during this hour (server-local time), so a
// daily subscriber receives at most one consolidated message per calendar day.
const DAILY_DIGEST_HOUR = 8;

/**
 * Returns true when the current broadcast run falls within the timeframe
 * that the subscriber's preferred frequency covers.
 *
 * - immediate: always matches (legacy behaviour, send on every run)
 * - daily:     matches once per calendar day, during the daily digest hour
 * - weekly:    matches once per ISO week      (script run on Monday)
 * - monthly:   matches once per calendar month (script run on 1st)
 *
 * The broadcaster runs every 30 s, so for digest frequencies we rely on
 * the OS/cron scheduling the process at the right clock time rather than
 * implementing an internal counter — simple and robust. Delivery cadence is
 * additionally enforced by the expiry_digest_deliveries table, so a digest is
 * never sent more than once per window even if the process restarts.
 */
export function shouldSendForFrequency(frequency: AlertFrequency, now: Date = new Date()): boolean {
    switch (frequency) {
        case "immediate":
            return true;
        case "daily":
            // Send once a day during the configured digest hour (server-local time).
            return now.getHours() === DAILY_DIGEST_HOUR;
        case "weekly":
            // Send on Monday (getDay() === 1)
            return now.getDay() === 1;
        case "monthly":
            // Send on the 1st of each month
            return now.getDate() === 1;
        default:
            return true;
    }
}

export function getLocalizedMessage(
    type: "counterfeit" | "recall" | "expiry",
    data: NotificationAlertData,
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
            gu: "🚨 {district} માં નકલી દવાનું એલર્ટ: {medicineName} ના બહુવિધ નકલી અહેવાલોની ચકાસણી કરવામાં આવી છે. કૃપા કરીને તમારા પેકેજિંગનું કાળજીપૂર્વક નિરીક્ષણ કરો.",
            kn: "🚨 {district} ನಲ್ಲಿ ನಕಲಿ ಔಷಧ ಎಚ್ಚರಿಕೆ: {medicineName} ನ ಬಹು ನಕಲಿ ವರದಿಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ಯಾಕೇಜಿಂಗ್ ಅನ್ನು ಎಚ್ಚರಿಕೆಯಿಂದ ಪರಿಶೀಲಿಸಿ.",
            ml: "🚨 {district} ൽ വ്യാജ മരുന്ന് മുന്നറിയിപ്പ്: {medicineName} ന്റെ ഒന്നിലധികം വ്യാജ റിപ്പോർട്ടുകൾ സ്ഥിരീകരിച്ചു. ദയവായി നിങ്ങളുടെ പാക്കേജിംഗ് ശ്രദ്ധയോടെ പരിശോധിക്കുക.",
            pa: "🚨 {district} ਵਿੱਚ ਨਕਲੀ ਦਵਾਈ ਦੀ ਚੇਤਾਵਨੀ: {medicineName} ਦੀਆਂ ਕਈ ਨਕਲੀ ਰਿਪੋਰਟਾਂ ਦੀ ਪੁਸ਼ਟੀ ਕੀਤੀ ਗਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਪੈਕੇਜਿੰਗ ਦੀ ਧਿਆਨ ਨਾਲ ਜਾਂਚ ਕਰੋ।",
            ur: "🚨 {district} میں جعلی دوا کا الرٹ: {medicineName} کی متعدد جعلی رپورٹس کی تصدیق ہو گئی ہے۔ براہ کرم اپنی پیکیجنگ کا بغور معائنہ کریں۔",
            as: "🚨 {district} ত নকল ঔষধৰ সতৰ্কবাণী: {medicineName} ৰ একাধিক নকল প্ৰতিবেদন প্ৰমাণিত হৈছে। অনুগ্ৰহ কৰি আপোনাৰ পেকেজিং সাৱধানে পৰীক্ষা কৰক।",
        },
        recall: {
            en: "🚨 Medicine Recall Alert: {medicineName} (Batch: {batchNumber}) has been flagged as substandard or recalled by CDSCO. Stop consumption immediately.",
            hi: "🚨 दवा वापसी अलर्ट: {medicineName} (बैच: {batchNumber}) को CDSCO द्वारा घटिया या वापस लेने योग्य घोषित किया गया है। तुरंत सेवन बंद करें।",
            ta: "🚨 மருந்து திரும்பப் பெறும் எச்சரிக்கை: {medicineName} (தொகுதி: {batchNumber}) தரமற்றது என CDSCO ஆல் அடையாளம் காணப்பட்டுள்ளது. உடனடியாகப் பயன்படுத்துவதை நிறுத்தவும்.",
            te: "🚨 మందుల ఉపసంహరణ హెచ్చరిక: {medicineName} (బ్యాంచ్: {batchNumber}) నాణ్యత లేనిదిగా CDSCO గుర్તించింది. వెంటనే వాడటం ఆపివేయండి.",
            bn: "🚨 ওষুধ প্রত্যাহারের সতর্কতা: {medicineName} (ব্যাচ: {batchNumber}) CDSCO দ্বারা নিম্নমানের বা প্রত্যাহার করা হয়েছে। অবিলম্বে ব্যবহার বন্ধ করুন।",
            mr: "🚨 औषध माघारीचा इशारा: {medicineName} (बॅच: {batchNumber}) CDSCO द्वारे निकृष्ट दर्जाचे घोषित करून मागे घेण्यात आले आहे. ताबडतोब वापर थांबवा.",
            gu: "🚨 દવા પાછી ખેંચવાનું એલર્ટ: {medicineName} (બેચ: {batchNumber}) ને CDSCO દ્વારા હલકી ગુણવત્તાવાળા અથવા પાછા ખેંચવા તરીકે ચિહ્નિત કરવામાં આવી છે. વપરાશ તાત્કાલિક બંધ કરો.",
            kn: "🚨 ಔಷಧ ಹಿಂಪಡೆಯುವ ಎಚ್ಚರಿಕೆ: {medicineName} (ಬ್ಯಾಚ್: {batchNumber}) ಅನ್ನು CDSCO ಕಳಪೆ ಅಥವಾ ಹಿಂಪಡೆಯಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿದೆ. ಸೇವನೆಯನ್ನು ತಕ್ಷಣವೇ ನಿಲ್ಲಿಸಿ.",
            ml: "🚨 മരുന്ന് തിരിച്ചുവിളിക്കൽ മുന്നറിയിപ്പ്: {medicineName} (ബാച്ച്: {batchNumber}) ഗുണനിലവാരമില്ലാത്തതാണെന്ന് CDSCO കണ്ടെത്തി അല്ലെങ്കിൽ തിരിച്ചുവിളിച്ചു. ഉപയോഗം ഉടൻ നിർത്തുക.",
            pa: "🚨 ਦਵਾਈ ਵਾਪਸ ਲੈਣ ਦੀ ਚੇਤਾਵਨੀ: {medicineName} (ਬੈਚ: {batchNumber}) ਨੂੰ CDSCO ਦੁਆਰਾ ਘਟੀਆ ਜਾਂ ਵਾਪਸ ਲੈਣ ਯੋਗ ਘੋਸ਼ਿਤ ਕੀਤਾ ਗਿਆ ਹੈ। ਤੁਰੰਤ ਸੇਵਨ ਬੰਦ ਕਰੋ।",
            ur: "🚨 دوا کی واپسی کا الرٹ: {medicineName} (بیچ: {batchNumber}) کو CDSCO کی طرف سے غیر معیاری یا واپس منگوا لیا گیا ہے۔ فوری طور پر استعمال بند کر دیں۔",
            as: "🚨 ঔষধ প্ৰত্যাহাৰৰ সতৰ্কবাণী: {medicineName} (বেটচ: {batchNumber}) ক CDSCO ৰ দ্বাৰা নিম্নমানৰ বা প্ৰত্যাহাৰ কৰা বুলি চিহ্নিত কৰা হৈছে। লগে লগে সেৱন কাম বন্ধ কৰক।",
        },
        expiry: {
            en: "⚠️ Medicine Expiry Warning: Batch {batchNumber} of {medicineName} is expiring soon (Expiry: {expiryDate}). Check your stock.",
            hi: "⚠️ दवा समाप्ति चेतावनी: {medicineName} का बैच {batchNumber} जल्द ही समाप्त हो रहा है (समाप्ति तिथि: {expiryDate})। अपने स्टॉक की जांच करें।",
            ta: "⚠️ மருந்து காலாவதி எச்சரிக்கை: {medicineName} இன் தொகுதி {batchNumber} விரைவில் காலாவதியாகிறது (காலாவதி: {expiryDate}). உங்கள் இருப்பை சரிபார்க்கவும்.",
            te: "⚠️ మందుల గడువు హెచ్చరిక: {medicineName} యొక్క బ్యాంచ్ {batchNumber} త్వరలో ముగియనుంది (గడువు: {expiryDate}). మీ నిల్వను తనిఖీ చేయండి.",
            bn: "⚠️ ওষুধ মেয়াদের সতর্কতা: {medicineName}-এর ব্যাচ {batchNumber} শীঘ্রই মেয়াদ শেষ হচ্ছে (মেয়াদ: {expiryDate})। আপনার স্টক পরীক্ষা করুন।",
            mr: "⚠️ औषध कालबाह्य इशारा: {medicineName} ची बॅच {batchNumber} लवकरच कालबाह्य होत आहे (कालबाह्यता: {expiryDate})। तुमचा साठा तपासा.",
            gu: "⚠️ દવા સમાપ્તિ ચેતવણી: {medicineName} ની બેચ {batchNumber} ટૂંક સમયમાં સમાપ્ત થઈ રહી છે (સમાપ્તિ: {expiryDate}). તમારો સ્ટોક તપાસો.",
            kn: "⚠️ ಔಷಧ ಅವಧಿ ಮುಗಿಯುವ ಎಚ್ಚರಿಕೆ: {medicineName} ನ ಬ್ಯಾಚ್ {batchNumber} ಶೀಘ್ರದಲ್ಲೇ ಅವಧಿ ಮುಗಿಯಲಿದೆ (ಅವಧಿ: {expiryDate}). ನಿಮ್ಮ ಸ್ಟಾಕ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ.",
            ml: "⚠️ മരുന്ന് കാലാവധി തീരുന്ന മുന്നറിയിപ്പ്: {medicineName} ന്റെ ബാച്ച് {batchNumber} ഉടൻ കാലാവധി തീരും (കാലാവധി: {expiryDate}). നിങ്ങളുടെ സ്റ്റോക്ക് പരിശോധിക്കുക.",
            pa: "⚠️ ਦਵਾਈ ਖਤਮ ਹੋਣ ਦੀ ਚੇਤਾਵਨੀ: {medicineName} ਦਾ ਬੈਚ {batchNumber} ਜਲਦੀ ਹੀ ਖਤਮ ਹੋ ਰਿਹਾ ਹੈ (ਮਿਆਦ: {expiryDate})। ਆਪਣੇ ਸਟਾਕ ਦੀ ਜਾਂਚ ਕਰੋ।",
            ur: "⚠️ دوا کی میعاد ختم ہونے کا انتباہ: {medicineName} کا بیچ {batchNumber} جلد ہی ختم ہو رہا ہے (میعاد: {expiryDate})۔ اپنا اسٹاک چیک کریں۔",
            as: "⚠️ ঔষধৰ ম্যাদ উকলি যোৱাৰ সতৰ্কবাণী: {medicineName} ৰ বেটচ {batchNumber} সোনকালে ম্যাদ উকলি যাব (ম্যাদ: {expiryDate})। আপোনাৰ ষ্টক পৰীক্ষা কৰক।",
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

async function acquireLock(): Promise<boolean> {
    if (!redisClient.isOpen) {
        // Redis unavailable — fall back to running (risk duplicate sends is preferable to silent drop)
        logger.warn("Redis not connected; skipping distributed lock for alert broadcaster.");
        return true;
    }
    try {
        const result = await redisClient.set(LOCK_KEY, LOCK_VALUE, {
            NX: true,
            PX: LOCK_TTL_MS,
        });
        return result === "OK";
    } catch (err) {
        logger.error({ message: "Failed to acquire broadcaster lock", error: err });
        return false;
    }
}

async function releaseLock(): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        // Only release if this process still owns the lock (Lua script for atomicity)
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
        await redisClient.eval(script, { keys: [LOCK_KEY], arguments: [LOCK_VALUE] });
    } catch (err) {
        logger.error({ message: "Failed to release broadcaster lock", error: err });
    }
}

/**
 * Replenishes the lock TTL so a slow broadcast run can never exceed the
 * original lock expiry and hand the lock over to the next scheduler tick or
 * another pod. Atomic Lua script: the TTL is extended only while this process
 * still owns the lock.
 */
async function renewLock(): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("pexpire", KEYS[1], ARGV[2])
            else
                return 0
            end
        `;
        await redisClient.eval(script, { keys: [LOCK_KEY], arguments: [LOCK_VALUE, LOCK_TTL_MS] });
    } catch (err) {
        logger.error({ message: "Failed to renew broadcaster lock", error: err });
    }
}

async function sendNotificationToSubscriber(
    sub: NotificationSubscriber,
    type: "counterfeit" | "recall" | "expiry",
    data: NotificationAlertData
): Promise<boolean> {
    const { title, body } = getLocalizedMessage(type, data, sub.language);
    const fullMessage = `${title}\n\n${body}`;

    const sendPromises: Promise<boolean>[] = [];
    if (sub.channels.includes("sms")) {
        sendPromises.push(smsService.send(sub.phone, fullMessage, sub.language));
    }
    if (sub.channels.includes("whatsapp")) {
        sendPromises.push(whatsappService.send(sub.phone, fullMessage, sub.language));
    }

    if (sendPromises.length === 0) return false;

    const results = await Promise.allSettled(sendPromises);
    return results.some((result) => result.status === "fulfilled" && result.value);
}

interface ExpiringBatchSummary {
    medicineName: string;
    batchNumber: string;
    expiryDate: string;
}

/**
 * Builds a single consolidated expiry message covering every expiring batch,
 * instead of one notification per batch. Reuses the existing per-batch
 * "expiry" localized template for each line so translations stay in one
 * place, then joins the lines under one localized header.
 */
function buildConsolidatedExpiryMessage(
    batchSummaries: ExpiringBatchSummary[],
    language: string
): { title: string; body: string } {
    const lines = batchSummaries.map((b) => {
        const { body } = getLocalizedMessage(
            "expiry",
            { medicineName: b.medicineName, batchNumber: b.batchNumber, expiryDate: b.expiryDate },
            language
        );
        return `• ${body}`;
    });

    const { title } = getLocalizedMessage("expiry", {} as NotificationAlertData, language);
    return { title, body: lines.join("\n") };
}

async function sendConsolidatedExpiryNotification(
    sub: NotificationSubscriber,
    batchSummaries: ExpiringBatchSummary[]
): Promise<boolean> {
    const { title, body } = buildConsolidatedExpiryMessage(batchSummaries, sub.language);
    const fullMessage = `${title}\n\n${body}`;

    const sendPromises: Promise<boolean>[] = [];
    if (sub.channels.includes("sms")) {
        sendPromises.push(smsService.send(sub.phone, fullMessage, sub.language));
    }
    if (sub.channels.includes("whatsapp")) {
        sendPromises.push(whatsappService.send(sub.phone, fullMessage, sub.language));
    }

    const results = await Promise.allSettled(sendPromises);
    return results.some((result) => result.status === "fulfilled" && result.value);
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

            let from = 0;
            let to = PAGE_SIZE - 1;
            let hasMore = true;
            let hasSuccessfulDelivery = false;

            while (hasMore) {
                const { data: subscribers, error: subsError } = await supabase
                    .from("notification_subscribers")
                    .select("*")
                    .eq("is_active", true)
                    .eq("status", "active")
                    .ilike("district", alert.district)
                    .range(from, to);

                if (subsError) {
                    logger.error({
                        message: "Failed to fetch subscribers for district alert",
                        error: subsError,
                    });
                    break;
                }

                if (!subscribers || subscribers.length === 0) {
                    break;
                }

                for (let i = 0; i < subscribers.length; i += NOTIFICATION_CHUNK_SIZE) {
                    const chunk = subscribers.slice(i, i + NOTIFICATION_CHUNK_SIZE);
                    const promises = chunk.map((sub) =>
                        sendNotificationToSubscriber(sub, "counterfeit", {
                            medicineName: alert.medicine_name,
                            district: alert.district,
                        })
                    );
                    const results = await Promise.allSettled(promises);
                    hasSuccessfulDelivery ||= results.some(
                        (result) => result.status === "fulfilled" && result.value
                    );
                }

                if (subscribers.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                    to += PAGE_SIZE;
                }
            }

            if (!hasSuccessfulDelivery) {
                logger.warn(
                    "District alert delivery failed for every eligible subscriber; will retry.",
                    { alertId: alert.id, district: alert.district }
                );
                continue;
            }

            const { error: markError } = await supabase
                .from("district_alerts")
                .update({ broadcasted: true })
                .eq("id", alert.id);

            if (markError) {
                logger.error({
                    message: "Failed to mark district alert as broadcasted",
                    error: markError,
                    alertId: alert.id,
                });
            }
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
            .eq("broadcasted", false)
            .or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`);

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

            let from = 0;
            let to = PAGE_SIZE - 1;
            let hasMore = true;
            let hasSuccessfulDelivery = false;

            while (hasMore) {
                let query = supabase
                    .from("notification_subscribers")
                    .select("*")
                    .eq("is_active", true)
                    .eq("status", "active");

                if (alert.district) {
                    query = query.ilike("district", alert.district);
                }

                const { data: subscribers, error: subsError } = await query.range(from, to);

                if (subsError) {
                    logger.error({
                        message: "Failed to fetch subscribers for drug alert",
                        error: subsError,
                    });
                    break;
                }

                if (!subscribers || subscribers.length === 0) {
                    break;
                }

                for (let i = 0; i < subscribers.length; i += NOTIFICATION_CHUNK_SIZE) {
                    const chunk = subscribers.slice(i, i + NOTIFICATION_CHUNK_SIZE);
                    const promises = chunk.map((sub) =>
                        sendNotificationToSubscriber(sub, "recall", {
                            medicineName: alert.reported_brand_name,
                            batchNumber: alert.batch_number,
                        })
                    );
                    const results = await Promise.allSettled(promises);
                    hasSuccessfulDelivery ||= results.some(
                        (result) => result.status === "fulfilled" && result.value
                    );
                }

                if (subscribers.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                    to += PAGE_SIZE;
                }
            }

            if (!hasSuccessfulDelivery) {
                logger.warn(
                    "Drug alert delivery failed for every eligible subscriber; will retry.",
                    { alertId: alert.id, drug: alert.reported_brand_name }
                );
                continue;
            }

            const { error: markError } = await supabase
                .from("drug_alerts")
                .update({ broadcasted: true })
                .eq("id", alert.id);

            if (markError) {
                logger.error({
                    message: "Failed to mark drug alert as broadcasted",
                    error: markError,
                    alertId: alert.id,
                });
            }
        }
    } catch (err) {
        logger.error({ message: "Error in broadcastDrugAlerts", error: err });
    }
}

interface ExpiringBatchRow {
    id: string;
    batch_number: string;
    expiry_date: string;
    medicine?: { brand_name: string } | null;
}

/**
 * Start of the window that a digest delivery's sent_at must fall inside for a
 * batch to count as already delivered at the given frequency. Only used for
 * daily/weekly/monthly — immediate deliveries are tracked on
 * batches.expiry_broadcasted. Aligned with shouldSendForFrequency() so a digest
 * is delivered at most once per calendar day / ISO week / calendar month.
 */
function getDigestWindowStart(frequency: AlertFrequency, now: Date): Date {
    const start = new Date(now);
    switch (frequency) {
        case "daily":
            start.setHours(0, 0, 0, 0);
            return start;
        case "weekly": {
            // Monday-aligned week start (getDay(): 0=Sun … 6=Sat)
            const daysSinceMonday = (start.getDay() + 6) % 7;
            start.setDate(start.getDate() - daysSinceMonday);
            start.setHours(0, 0, 0, 0);
            return start;
        }
        case "monthly":
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            return start;
        case "immediate":
        default:
            return new Date(0);
    }
}

/**
 * Fetches the batches that still need to be broadcast for the given frequency
 * in this run. Immediate batches are those never delivered
 * (expiry_broadcasted = false); digest batches are those with no delivery
 * recorded inside the frequency's current window.
 */
async function fetchPendingExpiryBatches(
    frequency: AlertFrequency,
    now: Date,
    todayStr: string,
    thirtyDaysFromNow: string
): Promise<ExpiringBatchRow[]> {
    if (frequency === "immediate") {
        const { data: expiringBatches, error } = await supabase
            .from("batches")
            .select("*, medicine:medicines(brand_name)")
            .gte("expiry_date", todayStr)
            .lte("expiry_date", thirtyDaysFromNow)
            .eq("expiry_broadcasted", false);

        if (error) {
            logger.error({ message: "Failed to fetch expiring batches", error });
            return [];
        }
        return (expiringBatches as ExpiringBatchRow[]) ?? [];
    }

    const windowStart = getDigestWindowStart(frequency, now).toISOString();

    const { data: delivered, error: deliveredError } = await supabase
        .from("expiry_digest_deliveries")
        .select("batch_id")
        .eq("frequency", frequency)
        .gte("sent_at", windowStart);

    if (deliveredError) {
        logger.error({
            message: "Failed to fetch already delivered expiry digest batches",
            error: deliveredError,
            frequency,
        });
        return [];
    }

    const deliveredIds = (delivered ?? []).map((row) => row.batch_id);

    let query = supabase
        .from("batches")
        .select("*, medicine:medicines(brand_name)")
        .gte("expiry_date", todayStr)
        .lte("expiry_date", thirtyDaysFromNow);

    if (deliveredIds.length > 0) {
        query = query.not("id", "in", deliveredIds);
    }

    const { data: expiringBatches, error } = await query;

    if (error) {
        logger.error({ message: "Failed to fetch expiring batches", error });
        return [];
    }
    return (expiringBatches as ExpiringBatchRow[]) ?? [];
}

async function subscriberExistsForFrequency(frequency: AlertFrequency): Promise<boolean> {
    const { data, error } = await supabase
        .from("notification_subscribers")
        .select("id")
        .eq("is_active", true)
        .eq("status", "active")
        .eq("preference_frequency", frequency)
        .range(0, 0);

    if (error) {
        logger.error({
            message: "Failed to check eligible subscribers",
            error,
            frequency,
        });
        return false;
    }
    return Boolean(data && data.length > 0);
}

async function markImmediateBatchesBroadcasted(batchIds: string[]): Promise<void> {
    for (let i = 0; i < batchIds.length; i += broadcastConfig.MARK_BROADCASTED_CHUNK_SIZE) {
        const chunk = batchIds.slice(i, i + broadcastConfig.MARK_BROADCASTED_CHUNK_SIZE);

        const { error: markError } = await supabase
            .from("batches")
            .update({ expiry_broadcasted: true })
            .in("id", chunk);

        if (markError) {
            logger.error({
                message: "Failed to mark delivered expiry alert batches as broadcasted",
                error: markError,
                batchIds: chunk,
            });
        }
    }
}

async function recordDigestDeliveries(
    batchIds: string[],
    frequency: AlertFrequency,
    now: Date
): Promise<void> {
    const sentAt = now.toISOString();
    for (let i = 0; i < batchIds.length; i += broadcastConfig.MARK_BROADCASTED_CHUNK_SIZE) {
        const chunk = batchIds.slice(i, i + broadcastConfig.MARK_BROADCASTED_CHUNK_SIZE);
        const rows = chunk.map((batchId) => ({ batch_id: batchId, frequency, sent_at: sentAt }));

        const { error } = await supabase
            .from("expiry_digest_deliveries")
            .upsert(rows, { onConflict: "batch_id,frequency" });

        if (error) {
            logger.error({
                message: "Failed to record expiry digest delivery",
                error,
                frequency,
                batchIds: chunk,
            });
        }
    }
}

async function broadcastExpiryToFrequency(
    frequency: AlertFrequency,
    pendingBatches: ExpiringBatchRow[],
    now: Date
): Promise<void> {
    const batchSummaries: ExpiringBatchSummary[] = pendingBatches.map((batch) => ({
        medicineName: batch.medicine?.brand_name || "Unknown Medicine",
        batchNumber: batch.batch_number,
        expiryDate: batch.expiry_date,
    }));

    let from = 0;
    let to = PAGE_SIZE - 1;
    let hasMore = true;
    let hasSuccessfulDelivery = false;

    while (hasMore) {
        const { data: subscribers, error: subsError } = await supabase
            .from("notification_subscribers")
            .select("*")
            .eq("is_active", true)
            .eq("status", "active")
            .eq("preference_frequency", frequency)
            .range(from, to);

        if (subsError) {
            logger.error({
                message: "Failed to fetch subscribers for expiry alerts",
                error: subsError,
                frequency,
            });
            return;
        }

        if (!subscribers || subscribers.length === 0) {
            break;
        }

        for (let i = 0; i < subscribers.length; i += NOTIFICATION_CHUNK_SIZE) {
            const chunk = subscribers.slice(i, i + NOTIFICATION_CHUNK_SIZE);
            const notificationPromises = chunk.map((sub) =>
                sendConsolidatedExpiryNotification(sub, batchSummaries)
            );
            const results = await Promise.allSettled(notificationPromises);
            hasSuccessfulDelivery ||= results.some(
                (result) => result.status === "fulfilled" && result.value
            );
        }

        if (subscribers.length < PAGE_SIZE) {
            hasMore = false;
        } else {
            from += PAGE_SIZE;
            to += PAGE_SIZE;
        }
    }

    if (!hasSuccessfulDelivery) {
        logger.warn("Expiry alert delivery failed for every eligible subscriber; will retry.", {
            frequency,
            batchIds: pendingBatches.map((batch) => batch.id),
        });
        return;
    }

    const deliveredBatchIds = pendingBatches.map((batch) => batch.id);
    if (frequency === "immediate") {
        await markImmediateBatchesBroadcasted(deliveredBatchIds);
    } else {
        await recordDigestDeliveries(deliveredBatchIds, frequency, now);
    }
}

export async function broadcastExpiryAlerts(now: Date = new Date()): Promise<void> {
    try {
        const todayStr = now.toISOString().split("T")[0];
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];

        // Each frequency bucket is processed independently, so one subscriber
        // receiving an alert never prevents another subscriber with a different
        // configured frequency from receiving their scheduled digest.
        const activeFrequencies = FREQUENCIES.filter((freq) => shouldSendForFrequency(freq, now));

        for (const frequency of activeFrequencies) {
            const pendingBatches = await fetchPendingExpiryBatches(
                frequency,
                now,
                todayStr,
                thirtyDaysFromNow
            );

            if (pendingBatches.length === 0) continue;

            // Skip marking anything as delivered when no subscriber is eligible
            // for this run's window, so the batches remain available for the
            // next scheduled digest run (e.g. weekly subscribers get it Monday).
            if (!(await subscriberExistsForFrequency(frequency))) {
                logger.info(
                    `No subscribers match frequency "${frequency}" for this run — skipping.`
                );
                continue;
            }

            logger.info(
                `Broadcasting medicine expiry warnings for ${pendingBatches.length} batches (frequency: ${frequency})`
            );

            await broadcastExpiryToFrequency(frequency, pendingBatches, now);
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

    // In-process run guard: never start a second broadcast in this process
    // while one is still in flight, even if the distributed lock has expired.
    if (isBroadcasting) {
        logger.info("Alert broadcaster already running in this process — skipping this tick.");
        return;
    }

    const acquired = await acquireLock();
    if (!acquired) {
        logger.info("Alert broadcaster lock held by another instance — skipping this tick.");
        return;
    }

    isBroadcasting = true;

    // Heartbeat: keep replenishing the lock TTL for the whole duration of the
    // run so slow SMS/WhatsApp provider calls can never let it expire.
    const renewalId = setInterval(() => {
        renewLock().catch((err) => {
            logger.error("Alert broadcaster: failed to renew lock", { error: err });
        });
    }, LOCK_RENEW_INTERVAL_MS);
    renewalId.unref?.();

    try {
        await broadcastDistrictAlerts();
        await broadcastDrugAlerts();
        await broadcastExpiryAlerts();
    } finally {
        clearInterval(renewalId);
        isBroadcasting = false;
        await releaseLock();
    }
}

export function startAlertBroadcaster(): { stop: () => void } {
    if (intervalId) {
        logger.warn("Alert broadcaster is already running.");
        return { stop: stopAlertBroadcaster };
    }

    logger.info(`Starting Alert Broadcaster periodic loop (interval: ${CHECK_INTERVAL_MS}ms)`);

    // Run initial execution after a short delay
    setTimeout(() => {
        checkAndBroadcastAll().catch((err) => {
            logger.error("Alert broadcaster: unhandled error during scheduled run", { error: err });
        });
    }, 2000);

    intervalId = setInterval(() => {
        checkAndBroadcastAll().catch((err) => {
            logger.error("Alert broadcaster: unhandled error during scheduled run", { error: err });
        });
    }, CHECK_INTERVAL_MS);

    return { stop: stopAlertBroadcaster };
}

export function stopAlertBroadcaster(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info("Stopped Alert Broadcaster periodic loop");
    }
}
