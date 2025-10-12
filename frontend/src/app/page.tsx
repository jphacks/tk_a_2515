"use client";

import { join } from "path";
import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import ContextPanel from "@/components/ContextPanel";
import Header from "@/components/Header";
import { MapPageClient } from "@/components/Map";
import { ZOOM_LEVEL_THRESHOLD } from "@/components/MapTerrain";
import type { Mountain, Path } from "./api/lib/models";
import type { PathDetail } from "./api/lib/models/pathDetail";
import { listMountainsMountainsGet } from "./api/lib/mountains/mountains";
import {
  getPathPathsPathIdGet,
  listPathsPathsGet,
} from "./api/lib/paths/paths";

export type BoundingBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  zoomLevel: number;
};

export default function HomePage() {
  const [_, setBounds] = useState<BoundingBox | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(
    null,
  );
  const [selectedPath, setSelectedPath] = useState<PathDetail | null>(null); // 追加
  const [hoveredPoint, setHoveredPoint] = useState<{
    lat: number;
    lon: number;
  } | null>(null); // ホバー地点

  // ✨ MapTerrainからデータを受け取るためのコールバック関数
  const handleBoundsChange = async (newBounds: BoundingBox) => {
    setBounds(newBounds);

    if (newBounds.zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
      const newMountains = await listMountainsMountainsGet({
        limit: 12345,
        minlon: newBounds.minLon,
        minlat: newBounds.minLat,
        maxlon: newBounds.maxLon,
        maxlat: newBounds.maxLat,
      });
      if (newMountains.status === 200) {
        setMountains(newMountains.data.items);
      } else {
        console.error("Failed to fetch mountains:", newMountains);
      }

      const newPaths = await listPathsPathsGet({
        limit: 1234567,
        minlon: newBounds.minLon,
        minlat: newBounds.minLat,
        maxlon: newBounds.maxLon,
        maxlat: newBounds.maxLat,
      });
      if (newPaths.status === 200) {
        console.log("Fetched paths within bounds:", newPaths.data.total);
        setPaths(newPaths.data.items);
      } else {
        console.error("Failed to fetch paths:", newPaths);
      }
    } else {
      setMountains([]);
      setPaths([]);
    }
  };

  const handleSelectMountain = (mountain: Mountain) => {
    setSelectedMountain(mountain);
    setSelectedPath(null); // パス選択をクリア
    setIsSheetOpen(true);
  };

  const handleSelectPath = async (path: Path) => {
    try {
      const response = await getPathPathsPathIdGet(path.osm_id);
      if (response.status === 200) {
        console.log("Fetched path details:", response.data);
        setSelectedPath(response.data);
      }
    } catch (error) {
      console.error("失敗", error);
    }
    setSelectedMountain(null); // 山選択をクリア
    setIsSheetOpen(true);
  };

  const handleClearSelection = () => {
    setSelectedMountain(null);
    setSelectedPath(null); // 追加
  };

  const handleToggleSheet = () => {
    setIsSheetOpen(!isSheetOpen);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
  };

  const handleHoverPointChange = (
    point: { lat: number; lon: number } | null,
  ) => {
    setHoveredPoint(point);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <ContextPanel
          mountains={mountains}
          selectedMountain={selectedMountain}
          selectedPath={selectedPath} // 追加
          onSelectMountain={handleSelectMountain}
          onSelectPath={handleSelectPath} // 追加
          onClearSelection={handleClearSelection}
          onHoverPointChange={handleHoverPointChange} // ホバー地点の変更
        />
        <MapPageClient
          mountains={mountains}
          paths={paths}
          onBoundsChange={handleBoundsChange}
          onSelectMountain={handleSelectMountain}
          selectedMountain={selectedMountain}
          onSelectPath={handleSelectPath} // 追加
          selectedPath={selectedPath} // 追加
          hoveredPoint={hoveredPoint} // ホバー地点
        />
      </main>
      <BottomSheet
        mountains={mountains}
        selectedMountain={selectedMountain}
        selectedPath={selectedPath} // 追加
        onSelectMountain={handleSelectMountain}
        onSelectPath={handleSelectPath} // 追加
        onClearSelection={handleClearSelection}
        isOpen={isSheetOpen}
        onToggle={handleToggleSheet}
        onClose={handleCloseSheet}
      />
    </div>
  );
}
