"use client";

import { useState } from "react";
import type {
  BearSighting,
  Mountain,
  Path,
  PathDetail,
} from "@/app/api/lib/models";
import type { BoundingBox } from "@/app/page";
import { MapTerrain } from "@/components/MapTerrain";

type StyleMode = "hybrid" | "normal";

interface Props {
  mountains: Mountain[];
  paths: Path[];
  bears: BearSighting[];
  onBoundsChange?: (bounds: BoundingBox) => void;
  onSelectMountain?: (mountain: Mountain) => void;
  selectedMountain?: Mountain | null;
  onSelectPath?: (path: Path) => void;
  selectedPath?: PathDetail | null;
  onSelectBear?: (bear: BearSighting) => void;
  selectedBear?: BearSighting | null;
  hoveredPoint?: { lat: number; lon: number } | null;
  showOnlyFavorites?: boolean;
  onToggleShowOnlyFavorites?: () => void;
  favoriteIds?: Set<number>;
}

export const MapPageClient = ({
  mountains,
  paths,
  bears,
  onBoundsChange,
  onSelectMountain,
  selectedMountain,
  onSelectPath,
  selectedPath,
  onSelectBear,
  selectedBear,
  hoveredPoint,
  showOnlyFavorites,
  onToggleShowOnlyFavorites,
  favoriteIds,
}: Props) => {
  const [mode, setMode] = useState<StyleMode>("normal");
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2.5 left-2.5 z-10 bg-white p-2.5 rounded shadow-md flex gap-2 w-48">
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={`flex items-center gap-2 p-2 rounded transition-colors cursor-pointer flex-1 justify-center ${
            mode === "normal"
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            className="w-5 h-5"
            fill="currentColor"
          >
            <title>Normal mode icon</title>
            <path d="M287.9 96L211.7 96C182.3 96 156.6 116.1 149.6 144.6L65.4 484.5C57.9 514.7 80.8 544 112 544L287.9 544L287.9 480C287.9 462.3 302.2 448 319.9 448C337.6 448 351.9 462.3 351.9 480L351.9 544L528 544C559.2 544 582.1 514.7 574.6 484.5L490.5 144.6C483.4 116.1 457.8 96 428.3 96L351.9 96L351.9 160C351.9 177.7 337.6 192 319.9 192C302.2 192 287.9 177.7 287.9 160L287.9 96zM351.9 288L351.9 352C351.9 369.7 337.6 384 319.9 384C302.2 384 287.9 369.7 287.9 352L287.9 288C287.9 270.3 302.2 256 319.9 256C337.6 256 351.9 270.3 351.9 288z" />
          </svg>
          通常
        </button>
        <button
          type="button"
          onClick={() => setMode("hybrid")}
          className={`flex items-center gap-2 p-2 rounded transition-colors cursor-pointer flex-1 justify-center ${
            mode === "hybrid"
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            className="w-5 h-5"
            fill="currentColor"
          >
            <title>Hybrid mode icon</title>
            <path d="M263 71C272.4 61.6 287.6 61.6 296.9 71L386.3 160.4L441.3 105.4C453.8 92.9 474.1 92.9 486.6 105.4L534.6 153.4C547.1 165.9 547.1 186.2 534.6 198.7L479.6 253.7L569 343.1C578.4 352.5 578.4 367.7 569 377L473 473C463.6 482.4 448.4 482.4 439.1 473L349.7 383.6L334.2 399.1C345.6 423.7 352 451.1 352 480C352 511.7 344.3 541.5 330.8 567.8C326.1 576.8 314.1 578.1 307 570.9L210.7 474.6L150.7 534.6C138.2 547.1 117.9 547.1 105.4 534.6C92.9 522.1 92.9 501.8 105.4 489.3L165.4 429.3L69.1 333C61.9 325.8 63.2 313.8 72.2 309.2C98.5 295.6 128.4 288 160 288C188.9 288 216.3 294.4 240.9 305.8L256.4 290.3L167 201C157.6 191.6 157.6 176.4 167 167.1L263 71zM280 121.9L217.9 184L290.3 256.4L352.4 194.3L280 121.9zM456 422.1L518.1 360L445.7 287.6L383.6 349.7L456 422.1z" />
          </svg>
          航空
        </button>
      </div>
      {onToggleShowOnlyFavorites && (
        <div className="absolute top-32 left-2.5 z-10 bg-white rounded shadow-md">
          <button
            type="button"
            onClick={onToggleShowOnlyFavorites}
            className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 transition-colors rounded text-sm cursor-pointer ${
              showOnlyFavorites ? "bg-yellow-50 text-yellow-700" : "text-gray-700"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`w-5 h-5 ${showOnlyFavorites ? "text-yellow-500" : "text-gray-400"}`}
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            お気に入りのみ
          </button>
        </div>
      )}
      <div className="absolute top-20 left-2.5 z-10 bg-white bg-opacity-90 rounded shadow w-48">
        <button
          type="button"
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-t cursor-pointer"
        >
          <h3 className="font-bold text-sm">凡例</h3>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform ${isLegendOpen ? "rotate-180" : ""}`}
          >
            <title>Toggle legend</title>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isLegendOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="p-3 text-sm border-t">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
                  <circle cx="50" cy="50" r="48" fill="#4e8fdf" stroke="white" strokeWidth="4"/>
                  <text x="50" y="50" fontSize="48" textAnchor="middle" dominantBaseline="central" fill="white">⛰️</text>
                </svg>
              </div>
              <span className="text-xs">山頂（標高に応じた色）</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-5 h-1 flex-shrink-0"
                style={{
                  backgroundColor: "#829DFF",
                  opacity: 0.8,
                }}
              ></div>
              <span className="text-xs">登山道</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
                  <circle cx="50" cy="50" r="48" fill="#D97706" stroke="white" strokeWidth="4"/>
                  <text x="50" y="50" fontSize="48" textAnchor="middle" dominantBaseline="central" fill="white">🐻</text>
                </svg>
              </div>
              <span className="text-xs">クマ目撃情報</span>
            </div>
            <div className="mt-2 pt-2 border-t text-xs text-gray-600">
              <div className="mb-1">標高による色分け</div>
              <div className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ff6b6b" }}></div>
                <span>～1000m</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ff8e53" }}></div>
                <span>1000～2000m</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ff6b9d" }}></div>
                <span>2000～3000m</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#845ec2" }}></div>
                <span>3000～4000m</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#4e8fdf" }}></div>
                <span>4000m～</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <MapTerrain
        styleMode={mode}
        mountains={mountains}
        paths={paths}
        bears={bears}
        onBoundsChange={onBoundsChange}
        onSelectMountain={onSelectMountain}
        selectedMountain={selectedMountain}
        onSelectPath={onSelectPath}
        selectedPath={selectedPath}
        onSelectBear={onSelectBear}
        selectedBear={selectedBear}
        hoveredPoint={hoveredPoint}
        showOnlyFavorites={showOnlyFavorites}
        favoriteIds={favoriteIds}
      />
    </div>
  );
};
