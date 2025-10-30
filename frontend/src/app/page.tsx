"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import ContextPanel from "@/components/ContextPanel";
import Header from "@/components/Header";
import { MapPageClient } from "@/components/Map";
import { ZOOM_LEVEL_THRESHOLD } from "@/components/MapTerrain";
import type { Mountain, Path } from "./api/lib/models";
import type { PathDetail } from "./api/lib/models/pathDetail";
import { mountainsList } from "./api/lib/mountains/mountains";
import {
  pathsBulkDeleteCreate,
  pathsList,
  pathsRetrieve,
} from "./api/lib/paths/paths";

export type BoundingBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  zoomLevel: number;
};

export default function HomePage() {
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(
    null,
  );
  const [selectedPath, setSelectedPath] = useState<PathDetail | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // ✨ MapTerrainからデータを受け取るためのコールバック関数
  const handleBoundsChange = async (newBounds: BoundingBox) => {
    setBounds(newBounds);

    if (newBounds.zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
      const newMountains = await mountainsList({
        limit: 16384,
        minlon: newBounds.minLon,
        minlat: newBounds.minLat,
        maxlon: newBounds.maxLon,
        maxlat: newBounds.maxLat,
      });
      if (newMountains.status === 200) {
        const sortedMountains = newMountains.data.results.sort(
          (a: Mountain, b: Mountain) => (b.elevation || 0) - (a.elevation || 0),
        );
        setMountains(sortedMountains);
      } else {
        console.error("Failed to fetch mountains:", newMountains);
      }

      const newPaths = await pathsList({
        limit: 16384,
        minlon: newBounds.minLon,
        minlat: newBounds.minLat,
        maxlon: newBounds.maxLon,
        maxlat: newBounds.maxLat,
      });
      if (newPaths.status === 200) {
        setPaths(newPaths.data.results);
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
    setSelectedMountain(null); // 山選択をクリア
    setIsSheetOpen(true);
    try {
      const response = await pathsRetrieve(path.osm_id);
      if (response.status === 200) {
        setSelectedPath(response.data);
      }
    } catch (error) {
      console.error("失敗", error);
    }
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

  const handleDeletePaths = async (bbox: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  }) => {
    try {
      // 自動生成されたAPIは第一引数にボディを要求するが、バックエンドは不要
      // biome-ignore lint/suspicious/noExplicitAny: Empty object required by auto-generated API signature
      const response = await pathsBulkDeleteCreate({} as any, {
        minlat: bbox.minLat,
        minlon: bbox.minLon,
        maxlat: bbox.maxLat,
        maxlon: bbox.maxLon,
      });

      if (response.status === 200) {
        console.log(`${response.data.deleted_count}件のパスを削除しました`);

        // 現在のビュー範囲でパスを再取得
        if (bounds && bounds.zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
          const newPaths = await pathsList({
            limit: 16384,
            minlon: bounds.minLon,
            minlat: bounds.minLat,
            maxlon: bounds.maxLon,
            maxlat: bounds.maxLat,
          });
          if (newPaths.status === 200) {
            setPaths(newPaths.data.results);
          }
        }
      }
    } catch (error) {
      console.error("削除エラー:", error);
      throw error;
    }
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
          onSelectPath={handleSelectPath}
          selectedPath={selectedPath}
          hoveredPoint={hoveredPoint}
          onDeletePaths={handleDeletePaths}
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
