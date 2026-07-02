"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GenericAlternative } from "@/components/GenericAlternativeCard";

interface BookmarksState {
    bookmarks: GenericAlternative[];
    addBookmark: (medicine: GenericAlternative) => void;
    removeBookmark: (medicineName: string) => void;
    isBookmarked: (medicineName: string) => boolean;
}

export const useBookmarksStore = create<BookmarksState>()(
    persist(
        (set, get) => ({
            bookmarks: [],

            addBookmark: (medicine) =>
                set((state) => {
                    const alreadyExists = state.bookmarks.some(
                        (item) => item.alternative_name === medicine.alternative_name
                    );
                    if (alreadyExists) return state;
                    return { bookmarks: [...state.bookmarks, medicine] };
                }),

            removeBookmark: (medicineName) =>
                set((state) => ({
                    bookmarks: state.bookmarks.filter(
                        (item) => item.alternative_name !== medicineName
                    ),
                })),

            isBookmarked: (medicineName) =>
                get().bookmarks.some((item) => item.alternative_name === medicineName),
        }),
        {
            name: "medicine-bookmarks",
        }
    )
);
