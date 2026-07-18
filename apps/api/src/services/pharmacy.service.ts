// apps/api/src/services/pharmacy.service.ts
import { PharmacyRepository } from "../repositories/pharmacy.repository";
import { buildOrConditions } from "../utils/db";

const pharmacyRepo = new PharmacyRepository();

export class PharmacyService {
    // Method 1: Handle registration rules validation & database flow
    async registerNewPharmacy(data: any, userId: string) {
        const { data: existing, error: lookupError } = await pharmacyRepo.findPharmacyByLicense(
            data.licenseId
        );
        if (lookupError) throw lookupError;
        if (existing) return { alreadyExists: true };

        const insertData = {
            name: data.name,
            license_id: data.licenseId,
            address: data.address,
            district: data.district,
            state: data.state,
            phone_number: data.phone_number ?? null,
            location:
                data.lat !== undefined && data.lng !== undefined
                    ? `POINT(${data.lng} ${data.lat})`
                    : null,
            is_verified: false,
            status: "pending",
            created_by: userId,
        };

        const { data: pharmacy, error: insertError } =
            await pharmacyRepo.createPharmacy(insertData);
        if (insertError) throw insertError;

        return { alreadyExists: false, pharmacy };
    }

    // Method 2: Process core multi-word index query arrays
    async searchByMedicine(words: string[], rawQuery: string) {
        const orFilter = buildOrConditions(["medicine_name"], words);
        const { data: inventoryRows, error: inventoryError } =
            await pharmacyRepo.searchInventoryByMedicines(orFilter);

        if (inventoryError) throw inventoryError;

        const pharmacyMap = new Map<string, any>();

        for (const row of inventoryRows ?? []) {
            const pharmacy = (row as any).pharmacies;
            if (!pharmacy || pharmacy.status !== "approved") continue;

            const pid: string = pharmacy.id;
            if (!pharmacyMap.has(pid)) {
                pharmacyMap.set(pid, {
                    pharmacy_id: pid,
                    pharmacy_name: pharmacy.name ?? "Unknown Pharmacy",
                    address: pharmacy.address ?? "Unknown Address",
                    district: pharmacy.district ?? null,
                    state: pharmacy.state ?? null,
                    phone_number: pharmacy.phone_number ?? null,
                    is_verified: pharmacy.is_verified ?? false,
                    matched_medicines: new Set<string>(),
                });
            }
            if (row.medicine_name) {
                pharmacyMap.get(pid)!.matched_medicines.add(row.medicine_name);
            }
        }

        const pharmacies = Array.from(pharmacyMap.values()).map(
            ({ matched_medicines, ...rest }) => ({
                ...rest,
                matched_medicines: Array.from(matched_medicines),
            })
        );

        return {
            pharmacies,
            query: rawQuery,
            total: pharmacies.length,
        };
    }
}
