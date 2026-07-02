export interface NotificationSubscriber {
    id: string;
    phone: string;
    language: string;
    channels: ("sms" | "whatsapp")[];
    district?: string;
    is_active: boolean;
}

export interface NotificationAlertData {
    medicineName: string;
    batchNumber?: string;
    district?: string;
    expiryDate?: string;
}
