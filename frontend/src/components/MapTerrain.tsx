"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Mountain, Path } from "@/app/api/lib/models";

export const ZOOM_LEVEL_THRESHOLD = 12; // ✨ ズームレベルの閾値を定義

type StyleMode = "hybrid" | "normal";

interface Props {
  styleMode?: StyleMode;
  mountains: Mountain[];
  paths: Path[];
  onBoundsChange?: (bounds: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
    zoomLevel: number;
  }) => void;
}

export const MapTerrain = ({
  styleMode = "hybrid",
  mountains,
  paths,
  onBoundsChange,
}: Props) => {
  if (!process.env.NEXT_PUBLIC_FULL_URL) {
    throw new Error(
      "Environment variable NEXT_PUBLIC_FULL_URL is not defined. Please set it in your environment.",
    );
  }

  const demTilesJsonUrl = `${process.env.NEXT_PUBLIC_FULL_URL}/api/proxy/tiles/terrain-rgb-v2/tiles.json`;
  const styleUrls = useMemo(
    () => ({
      hybrid: `https://api.maptiler.com/maps/hybrid/style.json`,
      normal: `https://api.maptiler.com/maps/topo-v2/style.json`,
    }),
    [],
  );

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const currentMode = useRef<StyleMode>(styleMode);

  const addDemAndTerrain = useCallback(() => {
    const m = map.current;
    if (!m) return;
    if (!m.getSource("maptiler-dem")) {
      m.addSource("maptiler-dem", { type: "raster-dem", url: demTilesJsonUrl });
    }
    m.setTerrain({ source: "maptiler-dem", exaggeration: 1.5 });
  }, [demTilesJsonUrl]);

  // pathsプロパティをGeoJSON形式に変換する関数
  const createGeoJSON = useCallback(
    (pathsData: Path[]): GeoJSON.FeatureCollection => {
      const features = pathsData.map((path, index) => {
        // ✨ geometries が存在しない場合は空の配列を返す
        const geometries = path.geometries || [];
        return {
          type: "Feature" as const,
          properties: { id: `path-${index}`, type: path.type },
          geometry: {
            type: "LineString" as const,
            coordinates: geometries
              .sort((a, b) => a.sequence - b.sequence) // ✨ sequence でソート
              .map(geometry => [geometry.lon, geometry.lat]), // [lon, lat] の順序に変換
          },
        };
      });

      return {
        type: "FeatureCollection",
        features,
      };
    },
    [],
  );

  // パスのソースとレイヤーを追加または更新する関数
  const addOrUpdatePaths = useCallback(() => {
    const m = map.current;
    if (!m) return;

    // ✨ 定数を使用してズームレベルを判定
    if (m.getZoom() < ZOOM_LEVEL_THRESHOLD) {
      if (m.getLayer("paths-layer")) m.removeLayer("paths-layer");
      if (m.getSource("paths-source")) m.removeSource("paths-source");
      return;
    }

    const geojsonData = createGeoJSON(paths);
    const source = m.getSource("paths-source") as maplibregl.GeoJSONSource;

    // ソースが既にあればデータを更新、なければ新しく追加
    if (source) {
      source.setData(geojsonData);
    } else {
      m.addSource("paths-source", {
        type: "geojson",
        data: geojsonData,
      });
      m.addLayer({
        id: "paths-layer",
        type: "line",
        source: "paths-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ff0000", // 線の色を赤に
          "line-width": 4, // 線の太さを4pxに
          "line-opacity": 0.8,
        },
      } as maplibregl.LineLayerSpecification);
    }
  }, [paths, createGeoJSON]);

  // mountainsプロパティをGeoJSON形式に変換する関数
  const createMountainGeoJSON = useCallback(
    (mountainsData: Mountain[]): GeoJSON.FeatureCollection => {
      const features = mountainsData.map(mountain => ({
        type: "Feature" as const,
        properties: {
          id: mountain.id,
          name: mountain.name,
          elevation: mountain.elevation,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [mountain.lon, mountain.lat].filter(
            coord => coord !== null && coord !== undefined,
          ) as [number, number], // [lon, lat] の順序
        },
      }));
      return {
        type: "FeatureCollection",
        features,
      };
    },
    [],
  );

  // 山のピンのソースとレイヤーを追加または更新する関数
  const addOrUpdateMountains = useCallback(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;

    // ✨ 定数を使用してズームレベルを判定
    if (m.getZoom() < ZOOM_LEVEL_THRESHOLD) {
      if (m.getLayer("mountains-labels")) m.removeLayer("mountains-labels");
      if (m.getLayer("mountains-points")) m.removeLayer("mountains-points");
      if (m.getSource("mountains-source")) m.removeSource("mountains-source");
      return;
    }

    const geojsonData = createMountainGeoJSON(mountains);

    if (m.getLayer("mountains-labels")) m.removeLayer("mountains-labels");
    if (m.getLayer("mountains-points")) m.removeLayer("mountains-points");
    if (m.getSource("mountains-source")) m.removeSource("mountains-source");

    m.addSource("mountains-source", {
      type: "geojson",
      data: geojsonData,
    });

    m.addLayer({
      id: "mountains-points",
      type: "circle",
      source: "mountains-source",
      paint: {
        "circle-color": "#c13b3b",
        "circle-radius": 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    m.addLayer({
      id: "mountains-labels",
      type: "symbol",
      source: "mountains-source",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#333333",
        "text-halo-color": "rgba(255, 255, 255, 0.9)",
        "text-halo-width": 1,
      },
    });
  }, [mountains, createMountainGeoJSON]);

  // 初期化用のuseEffect
  // biome-ignore lint/correctness/useExhaustiveDependencies: false positive
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrls[styleMode],
      center: [138.7273, 35.3606],
      zoom: 14,
      pitch: 60,
      bearing: 0,
      transformRequest: url => {
        const maptilerUrl = "https://api.maptiler.com/";
        if (url.startsWith(maptilerUrl)) {
          // URLから "https://api.maptiler.com/" を取り除く
          const pathAndQuery = url.substring(maptilerUrl.length);

          // パスとクエリを分離
          const [path, query] = pathAndQuery.includes("?")
            ? pathAndQuery.split("?")
            : [pathAndQuery, ""];

          // パスの種類に応じて適切なプロキシに振り分け
          if (path.startsWith("maps/")) {
            return {
              url: `${process.env.NEXT_PUBLIC_FULL_URL}/api/proxy/${path}${query ? `?${query}` : ""}`,
            };
          }
          if (path.startsWith("tiles/")) {
            return {
              url: `${process.env.NEXT_PUBLIC_FULL_URL}/api/proxy/${path}${query ? `?${query}` : ""}`,
            };
          }
        }
        return { url };
      },
    });

    // バウンディングボックスを処理する関数
    const handleMapMove = () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      const newBounds = {
        minLon: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLon: bounds.getEast(),
        maxLat: bounds.getNorth(),
      };

      const zoomLevel = map.current.getZoom();

      // ✨ 定数を使用してズームレベルを判定
      if (zoomLevel < ZOOM_LEVEL_THRESHOLD) {
        if (map.current.getLayer("mountains-labels"))
          map.current.removeLayer("mountains-labels");
        if (map.current.getLayer("mountains-points"))
          map.current.removeLayer("mountains-points");
        if (map.current.getSource("mountains-source"))
          map.current.removeSource("mountains-source");
        if (map.current.getLayer("paths-layer"))
          map.current.removeLayer("paths-layer");
        if (map.current.getSource("paths-source"))
          map.current.removeSource("paths-source");
      }

      if (onBoundsChange) {
        onBoundsChange({ ...newBounds, zoomLevel });
      }
    };

    // 初回ロード時に現在のバウンディングボックスを報告
    map.current.on("load", () => {
      addDemAndTerrain();
      addOrUpdatePaths();
      addOrUpdateMountains();

      // ✨ 初回ロード時に handleMapMove を呼び出す
      handleMapMove();
    });

    // マップの移動やズームが完了した時に発火する 'moveend' イベントにリスナーを登録
    map.current.on("moveend", handleMapMove);

    return () => {
      map.current?.off("moveend", handleMapMove);
      map.current?.remove();
    };
  }, []);

  // 更新用のuseEffect
  useEffect(() => {
    const m = map.current;
    if (!m || currentMode.current === styleMode) return;
    m.setStyle(styleUrls[styleMode]);
    m.once("styledata", () => {
      addDemAndTerrain();
      addOrUpdatePaths();
      addOrUpdateMountains();
    });
    currentMode.current = styleMode;
  }, [
    styleMode,
    styleUrls,
    addDemAndTerrain,
    addOrUpdatePaths,
    addOrUpdateMountains,
  ]);

  // pathsプロパティが変更された時にパスを更新
  // biome-ignore lint/correctness/useExhaustiveDependencies: false positive
  useEffect(() => {
    // マップが初期化される前に実行されるのを防ぐ
    if (!map.current?.isStyleLoaded()) return;
    addOrUpdatePaths();
  }, [paths, addOrUpdatePaths]);

  // mountainsプロパティが変更された時にピンを更新
  useEffect(() => {
    // マップが初期化される前に実行されるのを防ぐ
    if (!map.current?.isStyleLoaded()) return;
    addOrUpdateMountains();
  }, [addOrUpdateMountains]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
};
