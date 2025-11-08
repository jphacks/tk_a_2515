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
  favoriteIds,
}: Props) => {
  const [mode, setMode] = useState<StyleMode>("normal");
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2.5 left-2.5 z-10 bg-white p-2 rounded shadow-md flex gap-2 w-28">
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={`flex items-center p-2 rounded transition-colors cursor-pointer flex-1 justify-center ${
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
            <title>Normal Mode</title>
            <path d="M287.9 96L211.7 96C182.3 96 156.6 116.1 149.6 144.6L65.4 484.5C57.9 514.7 80.8 544 112 544L287.9 544L287.9 480C287.9 462.3 302.2 448 319.9 448C337.6 448 351.9 462.3 351.9 480L351.9 544L528 544C559.2 544 582.1 514.7 574.6 484.5L490.5 144.6C483.4 116.1 457.8 96 428.3 96L351.9 96L351.9 160C351.9 177.7 337.6 192 319.9 192C302.2 192 287.9 177.7 287.9 160L287.9 96zM351.9 288L351.9 352C351.9 369.7 337.6 384 319.9 384C302.2 384 287.9 369.7 287.9 352L287.9 288C287.9 270.3 302.2 256 319.9 256C337.6 256 351.9 270.3 351.9 288z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setMode("hybrid")}
          className={`flex items-center p-2 rounded transition-colors cursor-pointer flex-1 justify-center ${
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
            <title>Hybrid Mode</title>
            <path d="M263 71C272.4 61.6 287.6 61.6 296.9 71L386.3 160.4L441.3 105.4C453.8 92.9 474.1 92.9 486.6 105.4L534.6 153.4C547.1 165.9 547.1 186.2 534.6 198.7L479.6 253.7L569 343.1C578.4 352.5 578.4 367.7 569 377L473 473C463.6 482.4 448.4 482.4 439.1 473L349.7 383.6L334.2 399.1C345.6 423.7 352 451.1 352 480C352 511.7 344.3 541.5 330.8 567.8C326.1 576.8 314.1 578.1 307 570.9L210.7 474.6L150.7 534.6C138.2 547.1 117.9 547.1 105.4 534.6C92.9 522.1 92.9 501.8 105.4 489.3L165.4 429.3L69.1 333C61.9 325.8 63.2 313.8 72.2 309.2C98.5 295.6 128.4 288 160 288C188.9 288 216.3 294.4 240.9 305.8L256.4 290.3L167 201C157.6 191.6 157.6 176.4 167 167.1L263 71zM280 121.9L217.9 184L290.3 256.4L352.4 194.3L280 121.9zM456 422.1L518.1 360L445.7 287.6L383.6 349.7L456 422.1z" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={() => setIsLegendOpen(true)}
        className="absolute top-20 left-2.5 z-10 bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors cursor-pointer"
        aria-label="凡例を表示"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <title>凡例</title>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {isLegendOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(128, 128, 128, 0.5)" }}
          onClick={() => setIsLegendOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">凡例</h3>
              <button
                type="button"
                onClick={() => setIsLegendOpen(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                aria-label="閉じる"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <title>閉じる</title>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 100 100"
                    width="100%"
                    height="100%"
                  >
                    <title>山頂</title>
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="#4e8fdf"
                      stroke="white"
                      strokeWidth="4"
                    />
                    <text
                      x="50"
                      y="50"
                      fontSize="48"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                    >
                      ⛰️
                    </text>
                  </svg>
                </div>
                <span className="text-sm">山頂（標高に応じた色）</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-2 flex-shrink-0 rounded"
                  style={{
                    backgroundColor: "#829DFF",
                    opacity: 0.8,
                  }}
                ></div>
                <span className="text-sm">登山道</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 100 100"
                    width="100%"
                    height="100%"
                  >
                    <title>クマ</title>
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="#D97706"
                      stroke="white"
                      strokeWidth="4"
                    />
                    <text
                      x="50"
                      y="50"
                      fontSize="48"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                    >
                      🐻
                    </text>
                  </svg>
                </div>
                <span className="text-sm">クマ目撃情報</span>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="font-semibold mb-3 text-sm">標高による色分け</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#ff6b6b" }}
                    ></div>
                    <span className="text-sm">～1000m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#ff8e53" }}
                    ></div>
                    <span className="text-sm">1000～2000m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#ff6b9d" }}
                    ></div>
                    <span className="text-sm">2000～3000m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#845ec2" }}
                    ></div>
                    <span className="text-sm">3000～4000m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#4e8fdf" }}
                    ></div>
                    <span className="text-sm">4000m～</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
