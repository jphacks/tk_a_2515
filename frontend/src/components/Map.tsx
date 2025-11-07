"use client";

import { useState } from "react";
import type { Mountain, Path, PathDetail } from "@/app/api/lib/models";
import type { BoundingBox } from "@/app/page";
import { MapTerrain } from "@/components/MapTerrain";

type StyleMode = "hybrid" | "normal";

interface Props {
  mountains: Mountain[];
  paths: Path[];
  onBoundsChange?: (bounds: BoundingBox) => void;
  onSelectMountain?: (mountain: Mountain) => void;
  selectedMountain?: Mountain | null;
  onSelectPath?: (path: Path) => void;
  selectedPath?: PathDetail | null;
  hoveredPoint?: { lat: number; lon: number } | null;
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
  const [isLegendOpen, setIsLegendOpen] = useState(true);

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
      <div className="absolute top-20 left-2.5 z-10 bg-white bg-opacity-90 rounded shadow w-48">
        <button
          type="button"
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-t"
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
            isLegendOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="p-3 text-sm border-t">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{
                  background:
                    "linear-gradient(90deg, #ff6b6b, #ff8e53, #ff6b9d, #845ec2, #4e8fdf)",
                  border: "2px solid #ffffff",
                }}
              ></div>
              <span>山頂（標高に応じた色）</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-4 h-1 flex-shrink-0"
                style={{
                  backgroundColor: "#829DFF",
                  opacity: 0.8,
                }}
              ></div>
              <span>登山道</span>
            </div>
          </div>
        </div>
      </div>
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
