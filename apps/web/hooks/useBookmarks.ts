import { useState, useEffect } from 'react';

export const useBookmarks = () => {
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('medicine-bookmarks');
    if (saved) setBookmarks(JSON.parse(saved));
  }, []);

  const toggleBookmark = (medicine: any) => {
    setBookmarks((prev) => {
      const isBookmarked = prev.find((item) => item.id === medicine.id);
      let newBookmarks;
      if (isBookmarked) {
        newBookmarks = prev.filter((item) => item.id !== medicine.id);
      } else {
        newBookmarks = [...prev, medicine];
      }
      localStorage.setItem('medicine-bookmarks', JSON.stringify(newBookmarks));
      return newBookmarks;
    });
  };

  return { bookmarks, toggleBookmark };
};