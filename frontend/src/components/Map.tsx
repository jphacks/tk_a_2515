"use client";

import { useState } from "react";
import { MapTerrain } from "@/components/MapTerrain";

// MapTerrainが受け取るパスの型定義
type Path = {
  lat: number;
  lon: number;
}[];

type StyleMode = "hybrid" | "normal";

interface Props {
  initialPaths: Path[]; // サーバーから整形済みのパスデータを受け取る
}

export const MapPageClient = ({ initialPaths }: Props) => {
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
      <MapTerrain styleMode={mode} paths={initialPaths} />
    </div>
  );
};
