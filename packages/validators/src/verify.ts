import { z } from "zod";

export interface VerifySchemaMessages {
    batchNumberRequired?: string;
    batchNumberMin?: string;
    latitudeRange?: string;
    longitudeRange?: string;
    brandOrBarcodeRequired?: string;
}

export const getVerifyFields = (messages?: VerifySchemaMessages) => {
    return {
        batchNumber: z
            .string({
                message:
                    messages?.batchNumberRequired ?? "batchNumber is required and must be a string",
            })
            .min(3, messages?.batchNumberMin ?? "batchNumber must be at least 3 characters long"),
        brandName: z.string().optional(),
        barcodeId: z.string().optional(),
        latitude: z
            .number()
            .min(-90, messages?.latitudeRange ?? "Latitude must be between -90 and 90")
            .max(90, messages?.latitudeRange ?? "Latitude must be between -90 and 90")
            .optional(),
        longitude: z
            .number()
            .min(-180, messages?.longitudeRange ?? "Longitude must be between -180 and 180")
            .max(180, messages?.longitudeRange ?? "Longitude must be between -180 and 180")
            .optional(),
    };
};

export const getVerifySchema = (messages?: VerifySchemaMessages) => {
    return z.object(getVerifyFields(messages)).refine((data) => data.brandName || data.barcodeId, {
        message:
            messages?.brandOrBarcodeRequired ?? "Either brandName or barcodeId must be provided",
        path: ["brandName", "barcodeId"],
    });
};
