"use client";

import { useEffect, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import ContextPanel from "@/components/ContextPanel";
import FavoritesModal from "@/components/FavoritesModal";
import Header from "@/components/Header";
import { MapPageClient } from "@/components/Map";
import { ZOOM_LEVEL_THRESHOLD } from "@/components/MapTerrain";
import Tutorial from "@/components/Tutorial";
import { useFavorites } from "@/hooks/useFavorites";
import { bearList } from "./api/lib/bear/bear";
import type { BearSighting, Mountain, Path } from "./api/lib/models";
import type { PathDetail } from "./api/lib/models/pathDetail";
import { mountainsList } from "./api/lib/mountains/mountains";
import { pathsList, pathsRetrieve } from "./api/lib/paths/paths";

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
  const [bears, setBears] = useState<BearSighting[]>([]);
  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(
    null,
  );
  const [selectedPath, setSelectedPath] = useState<PathDetail | null>(null);
  const [selectedBear, setSelectedBear] = useState<BearSighting | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const favoriteIds = new Set(favorites.map(m => m.id));

  // 表示用の山リスト（お気に入りフィルター適用）
  const displayMountains = showOnlyFavorites
    ? mountains.filter(m => favoriteIds.has(m.id))
    : mountains;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tutorialCompleted = localStorage.getItem("tutorialCompleted");
      if (!tutorialCompleted) {
        setShowTutorial(true);
      }
    }

    // クマ情報を初期化時に全件取得
    const fetchBears = async () => {
      const response = await bearList({});
      if (response.status === 200) {
        const bearsData = Array.isArray(response.data)
          ? response.data
          : response.data.results || [];
        setBears(bearsData);
      } else {
        console.error("Failed to fetch bears:", response);
      }
    };

    fetchBears();
  }, []);

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

  const handleSelectBear = (bear: BearSighting) => {
    setSelectedMountain(null);
    setSelectedPath(null);
    setSelectedBear(bear);
    setIsSheetOpen(true);
  };

  const handleClearSelection = () => {
    setSelectedMountain(null);
    setSelectedPath(null);
    setSelectedBear(null);
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
      <Header
        onOpenTutorial={() => setShowTutorial(true)}
        onOpenFavorites={() => setShowFavoritesModal(true)}
        favoritesCount={favorites.length}
      />
      <Tutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      <FavoritesModal
        isOpen={showFavoritesModal}
        favorites={favorites}
        onClose={() => setShowFavoritesModal(false)}
        onSelectMountain={handleSelectMountain}
      />
      <main className="flex flex-1 overflow-hidden">
        <ContextPanel
          mountains={displayMountains}
          selectedMountain={selectedMountain}
          selectedPath={selectedPath}
          selectedBear={selectedBear}
          onSelectMountain={handleSelectMountain}
          onSelectPath={handleSelectPath}
          onSelectBear={handleSelectBear}
          onClearSelection={handleClearSelection}
          onHoverPointChange={handleHoverPointChange}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
        />
        <MapPageClient
          mountains={mountains}
          paths={paths}
          bears={bears}
          onBoundsChange={handleBoundsChange}
          onSelectMountain={handleSelectMountain}
          selectedMountain={selectedMountain}
          onSelectPath={handleSelectPath}
          selectedPath={selectedPath}
          onSelectBear={handleSelectBear}
          selectedBear={selectedBear}
          hoveredPoint={hoveredPoint}
          showOnlyFavorites={showOnlyFavorites}
          onToggleShowOnlyFavorites={() =>
            setShowOnlyFavorites(!showOnlyFavorites)
          }
          favoriteIds={favoriteIds}
        />
      </main>
      <BottomSheet
        mountains={displayMountains}
        selectedMountain={selectedMountain}
        selectedPath={selectedPath}
        selectedBear={selectedBear}
        onSelectMountain={handleSelectMountain}
        onSelectPath={handleSelectPath}
        onSelectBear={handleSelectBear}
        onClearSelection={handleClearSelection}
        onHoverPointChange={handleHoverPointChange}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        isOpen={isSheetOpen}
        onToggle={handleToggleSheet}
        onClose={handleCloseSheet}
      />
    </div>
  );
}
