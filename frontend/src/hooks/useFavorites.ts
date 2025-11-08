import { useEffect, useState } from "react";
import type { Mountain } from "@/app/api/lib/models";

const FAVORITES_KEY = "favorite_mountains";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Mountain[]>([]);

  // 初期化時にローカルストレージから読み込み
  useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to parse favorites:", error);
      }
    }
  }, []);

  // お気に入りを追加
  const addFavorite = (mountain: Mountain) => {
    setFavorites(prev => {
      const exists = prev.some(m => m.id === mountain.id);
      if (exists) return prev;

      const updated = [...prev, mountain];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // お気に入りを削除
  const removeFavorite = (mountainId: number) => {
    setFavorites(prev => {
      const updated = prev.filter(m => m.id !== mountainId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // お気に入りかどうか判定
  const isFavorite = (mountainId: number) => {
    return favorites.some(m => m.id === mountainId);
  };

  // お気に入りを切り替え
  const toggleFavorite = (mountain: Mountain) => {
    if (isFavorite(mountain.id)) {
      removeFavorite(mountain.id);
    } else {
      addFavorite(mountain);
    }
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}
