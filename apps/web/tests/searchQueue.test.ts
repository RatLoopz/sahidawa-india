import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import { openDB } from "idb";

jest.mock("idb", () => ({ openDB: jest.fn() }));

describe("search queue storage", () => {
    const records = new Map<string, unknown>();

    beforeEach(() => {
        records.clear();
        (openDB as jest.Mock).mockResolvedValue({
            put: async (_store: string, item: { id: string }) => records.set(item.id, item),
            getAll: async () => [...records.values()],
            delete: async (_store: string, id: string) => records.delete(id),
            clear: async () => records.clear(),
        });
    });

    it("removes only the selected ID, including when queries are duplicated", async () => {
        const { addToSearchQueue, getSearchQueue, removeFromSearchQueue } =
            await import("@/lib/db/searchQueue");
        const first = await addToSearchQueue("paracetamol");
        const duplicate = await addToSearchQueue("paracetamol");
        const third = await addToSearchQueue("ibuprofen");

        await removeFromSearchQueue(duplicate.id);
        expect((await getSearchQueue()).map(({ id }) => id)).toEqual([first.id, third.id]);

        await removeFromSearchQueue("missing-id");
        expect((await getSearchQueue()).map(({ id }) => id)).toEqual([first.id, third.id]);
    });
});
