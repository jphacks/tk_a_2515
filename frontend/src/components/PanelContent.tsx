import { ArrowLeft } from "lucide-react";
import type { Mountain } from "@/app/api/lib/models";

type Props = {
  mountains: Mountain[];
  selectedMountain: Mountain | null;
  onSelectMountain: (mountain: Mountain) => void;
  onClearSelection: () => void;
};

export default function PanelContent({
  mountains,
  selectedMountain,
  onSelectMountain,
  onClearSelection,
}: Props) {
  if (selectedMountain) {
    // 詳細表示
    return (
      <div className="p-5">
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-2 mb-4 text-sm text-green-700 font-semibold hover:text-green-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          山の一覧に戻る
        </button>
        <div className="aspect-video bg-slate-200 rounded-lg mb-4 flex items-center justify-center">
          <p className="text-slate-400">山の画像</p>
        </div>
        <h2 className="text-3xl font-bold text-slate-800">
          {selectedMountain.name}
        </h2>
        <p className="text-md text-slate-500 mb-4 font-medium">
          {selectedMountain.elevation?.toLocaleString()}m
        </p>
        <p className="text-slate-600 leading-relaxed">
          {selectedMountain.detail}
        </p>
      </div>
    );
  }

  // リスト表示
  return (
    <div>
      <div className="p-5 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">
          {mountains.length} 件の山
        </h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {mountains.map(mountain => (
          <li key={mountain.id} className="p-0">
            <button
              type="button"
              onClick={() => onSelectMountain(mountain)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectMountain(mountain);
                }
              }}
              className="w-full text-left p-5 hover:bg-green-50 cursor-pointer transition-colors"
            >
              <h3 className="font-bold text-slate-700">{mountain.name}</h3>
              <p className="text-sm text-slate-500">
                {mountain.elevation?.toLocaleString()}m
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
