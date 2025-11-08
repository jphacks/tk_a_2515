import { X } from "lucide-react";
import Image from "next/image";
import type { Mountain } from "@/app/api/lib/models";

type Props = {
  isOpen: boolean;
  favorites: Mountain[];
  onClose: () => void;
  onSelectMountain: (mountain: Mountain) => void;
};

export default function FavoritesModal({
  isOpen,
  favorites,
  onClose,
  onSelectMountain,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">お気に入りの山</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {favorites.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-lg mb-2">お気に入りの山はまだありません</p>
              <p className="text-sm">山の詳細ページからお気に入りに追加できます</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {favorites.map(mountain => (
                <li key={mountain.id} className="p-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMountain(mountain);
                      onClose();
                    }}
                    className="w-full text-left p-5 hover:bg-green-50 cursor-pointer transition-colors flex items-center gap-4"
                  >
                    {mountain.photo_url ? (
                      <Image
                        src={mountain.photo_url}
                        alt={mountain.name}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                        width={64}
                        height={64}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                        画像なし
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-700">{mountain.name}</h3>
                      {mountain.elevation && !Number.isNaN(mountain.elevation) && (
                        <p className="text-sm text-slate-500">
                          標高: {mountain.elevation.toLocaleString()} m
                        </p>
                      )}
                      {mountain.prefectures && mountain.prefectures.length > 0 && (
                        <p className="text-sm text-slate-500">
                          都道府県:{" "}
                          {mountain.prefectures.map(p => p.name).join(", ")}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
