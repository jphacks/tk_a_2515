"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

type StyleMode = "hybrid" | "normal";

// パスデータの型定義
type Path = {
  lat: number;
  lon: number;
}[];

interface Props {
  styleMode?: StyleMode;
  paths?: Path[]; // 複数のパスを描画できるよう配列の配列にする
}

export const MapTerrain = ({ styleMode = "hybrid", paths = [] }: Props) => {
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
      const features = pathsData.map((path, index) => ({
        type: "Feature" as const,
        properties: { id: `path-${index}` },
        geometry: {
          type: "LineString" as const,
          // データを [lon, lat] の順序に変換
          coordinates: path.map(p => [p.lon, p.lat]),
        },
      }));
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

  // 初期化用のuseEffect
  // biome-ignore lint/correctness/useExhaustiveDependencies: false positive
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrls[styleMode],
      center: [138.7273, 35.3606],
      zoom: 12,
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

    map.current.on("load", () => {
      addDemAndTerrain();
      addOrUpdatePaths();
    });

    return () => {
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
    });
    currentMode.current = styleMode;
  }, [styleMode, styleUrls, addDemAndTerrain, addOrUpdatePaths]);

  // pathsプロパティが変更された時にパスを更新
  // biome-ignore lint/correctness/useExhaustiveDependencies: false positive
  useEffect(() => {
    // マップが初期化される前に実行されるのを防ぐ
    if (!map.current?.isStyleLoaded()) return;
    addOrUpdatePaths();
  }, [paths, addOrUpdatePaths]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
};
