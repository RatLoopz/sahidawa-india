import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

const trackerPath = "/en/expiry-tracker";
const storageKey = "sahidawa_expiry_tracker";
const medicine = {
    name: "Offline Restore Test Medicine",
    expiryDate: "2027-12-31",
    batchNumber: "E2E-BATCH-2333",
    notes: "Created by expiry tracker offline restore E2E",
};

test.describe("Expiry Tracker backup and restore", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript((key) => {
            for (const storageKey of Object.keys(window.localStorage)) {
                if (storageKey.startsWith("sb-")) {
                    window.localStorage.removeItem(storageKey);
                }
            }
            window.localStorage.setItem(key, "[]");
        }, storageKey);
        await page.goto(trackerPath);
        await expect(page.getByText("Total: 0")).toBeVisible();
        await expect(page.getByRole("button", { name: "Add to Tracker" })).toBeEnabled();
    });

    test("exports a medicine backup and restores it while offline", async ({ context, page }) => {
        const nameInput = page.getByPlaceholder("e.g. Paracetamol");
        const expiryInput = page.locator('input[type="date"]');
        const batchInput = page.getByPlaceholder("e.g. B12345");
        const notesInput = page.getByPlaceholder("Storage instructions or dosage notes...");

        await nameInput.click();
        await page.keyboard.type(medicine.name);
        await expiryInput.fill(medicine.expiryDate);
        await batchInput.click();
        await page.keyboard.type(medicine.batchNumber);
        await notesInput.click();
        await page.keyboard.type(medicine.notes);

        await expect(nameInput).toHaveValue(medicine.name);
        await expect(expiryInput).toHaveValue(medicine.expiryDate);
        await expect(batchInput).toHaveValue(medicine.batchNumber);
        await expect(notesInput).toHaveValue(medicine.notes);

        await page.getByRole("button", { name: "Add to Tracker" }).click();

        await expect(page.getByRole("heading", { name: medicine.name })).toBeVisible();
        await expect(page.getByText(medicine.batchNumber)).toBeVisible();
        await expect(page.getByText(medicine.notes)).toBeVisible();
        await expect(page.getByRole("button", { name: "Export Backup" })).toBeEnabled();

        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export Backup" }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe("sahidawa_expiry_backup.json");

        const backupPath = test.info().outputPath("sahidawa_expiry_backup.json");
        await download.saveAs(backupPath);
        await expectBackupFile(backupPath);

        await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);
        await page.reload();
        await expect(page.getByText("Total: 0")).toBeVisible();

        await context.setOffline(true);

        await page.locator('input[type="file"]').setInputFiles(backupPath);

        await expect(page.getByRole("heading", { name: medicine.name })).toBeVisible();
        await expect(page.getByText(medicine.batchNumber)).toBeVisible();
        await expect(page.getByText(medicine.notes)).toBeVisible();

        const restored = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
        expect(restored).toContain(medicine.name);
        expect(restored).toContain(medicine.batchNumber);
    });
});

async function expectBackupFile(path: string) {
    const contents = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(contents);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                name: medicine.name,
                expiryDate: medicine.expiryDate,
                batchNumber: medicine.batchNumber,
                notes: medicine.notes,
            }),
        ])
    );
}
