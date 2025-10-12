"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { renderToString } from "react-dom/server";
import type { Mountain, Path } from "@/app/api/lib/models";
import { MountainTooltip } from "./MountainTooltip";

export const ZOOM_LEVEL_THRESHOLD = 10;

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
  onSelectMountain?: (mountain: Mountain) => void;
  selectedMountain?: Mountain | null; // ✨ 選択された山を受け取るプロパティを追加
  onSelectPath?: (path: Path) => void; // 追加
  selectedPath?: Path | null; // 追加
}

export const MapTerrain = ({
  styleMode = "hybrid",
  mountains,
  paths,
  onBoundsChange,
  onSelectMountain,
  selectedMountain, // ✨ プロパティを受け取り
  onSelectPath,
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
          properties: {
            ...path,
          },
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: for performance optimization
  const addOrUpdatePaths = useCallback(() => {
    const m = map.current;
    if (!m) return;

    // ✨ 定数を使用してズームレベルを判定
    if (m.getZoom() < ZOOM_LEVEL_THRESHOLD) {
      // ✨ レイヤーを先に削除してからソースを削除
      if (m.getLayer("paths-layer")) m.removeLayer("paths-layer");
      if (m.getLayer("paths-layer-shadow")) m.removeLayer("paths-layer-shadow");
      if (m.getSource("paths-source")) m.removeSource("paths-source");
      return;
    }

    const geojsonData = createGeoJSON(paths);
    const source = m.getSource("paths-source") as maplibregl.GeoJSONSource;

    // ソースが既にあればデータを更新、なければ新しく追加
    if (source) {
      source.setData(geojsonData);
    } else {
      // ✨ 影レイヤーを削除
      if (m.getLayer("paths-layer-shadow")) m.removeLayer("paths-layer-shadow");

      // ✨ 単色のパスレイヤーを追加
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
          "line-color": "#90EE90", // ✨ 薄い緑色 (LightGreen)
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            4,
            16,
            6,
            20,
            8,
          ],
          "line-opacity": 0.7,
        },
      });

      // ✨ Pathクリック時の処理を追加
      m.on("click", "paths-layer", e => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        if (onSelectPath) {
          onSelectPath(feature.properties as Path);
        }
      });

      // ✨ Pathホバー時のスタイリング
      m.on("mouseenter", "paths-layer", () => {
        m.getCanvas().style.cursor = "pointer";
      });

      m.on("mouseleave", "paths-layer", () => {
        m.getCanvas().style.cursor = "";
      });
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
      // ✨ レイヤーを先に削除してからソースを削除
      if (m.getLayer("mountains-labels")) m.removeLayer("mountains-labels");
      if (m.getLayer("mountains-points")) m.removeLayer("mountains-points");
      if (m.getLayer("mountains-points-shadow"))
        m.removeLayer("mountains-points-shadow");
      if (m.getSource("mountains-source")) m.removeSource("mountains-source");
      return;
    }

    const geojsonData = createMountainGeoJSON(mountains);

    // ✨ レイヤーを先に削除してからソースを削除
    if (m.getLayer("mountains-labels")) m.removeLayer("mountains-labels");
    if (m.getLayer("mountains-points")) m.removeLayer("mountains-points");
    if (m.getLayer("mountains-points-shadow"))
      m.removeLayer("mountains-points-shadow");
    if (m.getSource("mountains-source")) m.removeSource("mountains-source");

    m.addSource("mountains-source", {
      type: "geojson",
      data: geojsonData,
    });

    // ✨ 影レイヤー（背景）
    m.addLayer({
      id: "mountains-points-shadow",
      type: "circle",
      source: "mountains-source",
      paint: {
        "circle-color": "rgba(0, 0, 0, 0.3)",
        "circle-radius": 8,
        "circle-translate": [2, 2],
        "circle-blur": 0.5,
      },
    });

    // ✨ メインの山ピンレイヤー（グラデーション効果）
    m.addLayer({
      id: "mountains-points",
      type: "circle",
      source: "mountains-source",
      paint: {
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "elevation"],
          0,
          "#ff6b6b",
          1000,
          "#ff8e53",
          2000,
          "#ff6b9d",
          3000,
          "#845ec2",
          4000,
          "#4e8fdf",
        ],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          5,
          16,
          8,
          20,
          12,
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          2,
          16,
          3,
          20,
          4,
        ],
        "circle-opacity": 0.9,
        "circle-stroke-opacity": 1,
      },
    });

    // ✨ 改善されたラベルレイヤー
    m.addLayer({
      id: "mountains-labels",
      type: "symbol",
      source: "mountains-source",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Bold"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          10,
          16,
          12,
          20,
          14,
        ],
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-allow-overlap": false,
        "text-optional": true,
      },
      paint: {
        "text-color": "#2d3748",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 2,
        "text-halo-blur": 1,
      },
    });

    // ✨ ピンをクリックした際にスタイリングされたツールチップを表示
    m.on("click", "mountains-points", e => {
      if (!e.features || !e.features[0]) return;

      // ✨ 既存のポップアップを閉じる
      const existingPopups = document.querySelectorAll(".maplibregl-popup");
      for (const popup of existingPopups) {
        popup.remove();
      }

      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { name, elevation, id } = feature.properties;

      // ✨ 対応する山のデータを見つける
      const selectedMountain = mountains.find(m => m.id === id);

      // カスタムツールチップをHTMLとして生成
      const tooltipHtml = renderToString(
        <MountainTooltip name={name} elevation={elevation} />,
      );

      // カスタムスタイルのPopupを作成
      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        closeOnMove: false,
        offset: 25,
        className: "custom-mountain-popup",
        maxWidth: "300px",
      })
        .setLngLat(coordinates as [number, number])
        .setHTML(tooltipHtml)
        .addTo(m);

      // ✨ ツールチップ内の「クリックして詳細を表示」ボタンにイベントリスナーを追加
      setTimeout(() => {
        const detailButton = popup
          .getElement()
          ?.querySelector("[data-detail-button]");
        if (detailButton && selectedMountain && onSelectMountain) {
          detailButton.addEventListener("click", e => {
            e.stopPropagation();
            onSelectMountain(selectedMountain);
            popup.remove();
          });
        }
      }, 0);

      // ✨ ポップアップが確実に閉じるようにイベントリスナーを追加
      const closeButton = popup
        .getElement()
        ?.querySelector(".maplibregl-popup-close-button");
      if (closeButton) {
        closeButton.addEventListener("click", () => {
          popup.remove();
        });
      }
    });

    // ✨ ホバー効果
    m.on("mouseenter", "mountains-points", e => {
      m.getCanvas().style.cursor = "pointer";
      if (e.features?.[0]) {
        m.setPaintProperty("mountains-points", "circle-radius", [
          "case",
          ["==", ["get", "id"], e.features[0].properties.id],
          ["interpolate", ["linear"], ["zoom"], 12, 7, 16, 10, 20, 14],
          ["interpolate", ["linear"], ["zoom"], 12, 5, 16, 8, 20, 12],
        ]);
      }
    });

    m.on("mouseleave", "mountains-points", () => {
      m.getCanvas().style.cursor = "";
      m.setPaintProperty("mountains-points", "circle-radius", [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        5,
        16,
        8,
        20,
        12,
      ]);
    });
  }, [mountains, createMountainGeoJSON, onSelectMountain]); // ✨ onSelectMountain を依存配列に追加

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
        // ✨ レイヤーを先に削除してからソースを削除
        if (map.current.getLayer("mountains-labels"))
          map.current.removeLayer("mountains-labels");
        if (map.current.getLayer("mountains-points"))
          map.current.removeLayer("mountains-points");
        if (map.current.getLayer("mountains-points-shadow"))
          map.current.removeLayer("mountains-points-shadow");
        if (map.current.getSource("mountains-source"))
          map.current.removeSource("mountains-source");
        if (map.current.getLayer("paths-layer"))
          map.current.removeLayer("paths-layer");
        if (map.current.getLayer("paths-layer-shadow"))
          map.current.removeLayer("paths-layer-shadow");
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

  // ✨ 指定された山の位置にジャンプする関数
  const jumpToMountain = useCallback((mountain: Mountain) => {
    const m = map.current;
    if (!m) return;

    // ✨ 座標が有効な場合のみジャンプ
    if (mountain.lon !== undefined && mountain.lat !== undefined) {
      // ✨ 標高に基づいてカメラ設定を動的に調整
      const elevation = mountain.elevation || 0;

      // 標高に応じたズームレベルの調整
      let zoom: number;
      if (elevation >= 3000) {
        zoom = 14; // 高山は少し引いて全体を見せる
      } else if (elevation >= 2000) {
        zoom = 15; // 中山は中程度のズーム
      } else if (elevation >= 1000) {
        zoom = 16; // 低山は近めで詳細を見せる
      } else {
        zoom = 17; // 丘陵は最も近くで詳細を見せる
      }

      // 標高に応じたピッチの調整（高い山ほど立体的に見せる）
      let pitch: number;
      if (elevation >= 3000) {
        pitch = 70; // 高山は立体感を強調
      } else if (elevation >= 2000) {
        pitch = 65; // 中山は適度な立体感
      } else if (elevation >= 1000) {
        pitch = 60; // 低山は標準的な立体感
      } else {
        pitch = 45; // 丘陵は控えめな立体感
      }

      // 標高に応じたベアリングの調整（地形の特徴が見やすい角度）
      let bearing: number;
      if (elevation >= 3000) {
        bearing = 45; // 高山は斜めから見て稜線を強調
      } else if (elevation >= 2000) {
        bearing = 30; // 中山は適度な角度
      } else if (elevation >= 1000) {
        bearing = 15; // 低山は軽い角度
      } else {
        bearing = 0; // 丘陵は正面から
      }

      // ✨ アニメーション時間も標高に応じて調整
      let duration: number;
      if (elevation >= 3000) {
        duration = 2000; // 高山はゆっくりとアプローチ
      } else if (elevation >= 2000) {
        duration = 1800; // 中山は適度な速度
      } else {
        duration = 1500; // 低山・丘陵は標準速度
      }

      m.easeTo({
        center: [Number(mountain.lon), Number(mountain.lat)],
        zoom,
        pitch,
        bearing,
        duration,
      });
    }
  }, []);

  // ✨ selectedMountainが変更されたときに地図をジャンプさせる
  useEffect(() => {
    if (selectedMountain) {
      jumpToMountain(selectedMountain);
    }
  }, [selectedMountain, jumpToMountain]);

  const toggle2D3D = useCallback(() => {
    const m = map.current;
    if (!m) return;

    const currentPitch = m.getPitch();
    if (currentPitch > 0) {
      m.easeTo({ pitch: 0, bearing: 0 }); // 3D → 2D（鉛直上方向）
    } else {
      m.easeTo({ pitch: 60, bearing: 30 }); // 2D → 3D（高さ方向斜め）
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {/* ✨ 改善されたカスタムPopupのスタイル */}
      <style jsx global>{`
        .custom-mountain-popup .maplibregl-popup-content {
          padding: 0 !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
          border: 1px solid rgba(0, 0, 0, 0.05) !important;
          backdrop-filter: blur(10px) !important;
          background: rgba(255, 255, 255, 0.95) !important;
        }
        .custom-mountain-popup .maplibregl-popup-tip {
          border-top-color: rgba(255, 255, 255, 0.95) !important;
        }
        .custom-mountain-popup .maplibregl-popup-close-button {
          color: #6b7280 !important;
          font-size: 18px !important;
          padding: 6px 10px !important;
          background: rgba(255, 255, 255, 0.9) !important;
          border: none !important;
          border-radius: 6px !important;
          margin: 4px !important;
          transition: all 0.2s ease !important;
          cursor: pointer !important;
          z-index: 1000 !important;
        }
        .custom-mountain-popup .maplibregl-popup-close-button:hover {
          color: #374151 !important;
          background: rgba(239, 68, 68, 0.2) !important;
          transform: scale(1.05) !important;
        }
        .custom-mountain-popup .maplibregl-popup-close-button:active {
          transform: scale(0.95) !important;
        }
      `}</style>
      {/* ✨ ボタンコンテナ */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => map.current?.zoomIn()}
          className="p-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-100"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => map.current?.zoomOut()}
          className="p-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-100"
        >
          -
        </button>
        <button
          type="button"
          onClick={toggle2D3D}
          className="p-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-100"
        >
          2D/3D
        </button>
      </div>
    </div>
  );
};
