"use client";

import { useState } from "react";
import type { Mountain, Path } from "@/app/api/lib/models";
import type { BoundingBox } from "@/app/page";
import { MapTerrain } from "@/components/MapTerrain";

type StyleMode = "hybrid" | "normal";

interface Props {
  mountains: Mountain[];
  paths: Path[];
  onBoundsChange?: (bounds: BoundingBox) => void;
  onSelectMountain?: (mountain: Mountain) => void;
  selectedMountain?: Mountain | null; // ✨ プロパティを追加
  onSelectPath?: (path: Path) => void; // 追加
  selectedPath?: Path | null; // 追加
  hoveredPoint?: { lat: number; lon: number } | null; // ホバー地点
}

export const MapPageClient = ({
  mountains,
  paths,
  onBoundsChange,
  onSelectMountain,
  selectedMountain, // ✨ プロパティを受け取り
  onSelectPath, // 追加
  selectedPath, // 追加
  hoveredPoint, // ホバー地点
}: Props) => {
  const [mode, setMode] = useState<StyleMode>("normal");

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2.5 left-2.5 z-10 bg-white p-2.5 rounded shadow-md">
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={`mr-2 font-medium ${
            mode === "normal" ? "font-bold text-blue-500" : "text-gray-700"
          }`}
        >
          通常地図
        </button>
        <button
          type="button"
          onClick={() => setMode("hybrid")}
          className={`font-medium ${
            mode === "hybrid" ? "font-bold text-blue-500" : "text-gray-700"
          }`}
        >
          航空写真
        </button>
      </div>

      {/* MapTerrainにモードと整形済みパスデータを渡す */}
      <MapTerrain
        styleMode={mode}
        mountains={mountains}
        paths={paths}
        onBoundsChange={onBoundsChange}
        onSelectMountain={onSelectMountain}
        selectedMountain={selectedMountain}
        onSelectPath={onSelectPath} // 追加
        selectedPath={selectedPath} // 追加
        hoveredPoint={hoveredPoint} // ホバー地点
      />
    </div>
  );
};
