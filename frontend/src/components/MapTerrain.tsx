"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import type { Mountain, Path, PathDetail } from "@/app/api/lib/models";
import { MountainTooltip } from "./MountainTooltip";

export const ZOOM_LEVEL_THRESHOLD = 11;

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
  selectedMountain?: Mountain | null;
  onSelectPath?: (path: Path) => void;
  selectedPath?: PathDetail | null;
  hoveredPoint?: { lat: number; lon: number } | null;
  onDeletePaths?: (bbox: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  }) => Promise<void>;
}

export const MapTerrain = ({
  styleMode = "hybrid",
  mountains,
  paths,
  onBoundsChange,
  onSelectMountain,
  selectedMountain,
  onSelectPath,
  hoveredPoint,
  onDeletePaths,
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
  const hoveredPointMarker = useRef<maplibregl.Marker | null>(null);

  // 矩形選択モードの状態
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [currentPoint, setCurrentPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);

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
      const features = pathsData.map((path, _) => {
        // ✨ geometries が存在しない場合は空の配列を返す
        const geometries = path.geometries || [];
        // readonlyの配列をコピーしてからソート
        const sortedGeometries = [...geometries].sort(
          (a, b) => a.sequence - b.sequence,
        );
        return {
          type: "Feature" as const,
          properties: {
            ...path,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: sortedGeometries.map(geometry => [
              geometry.lon,
              geometry.lat,
            ]), // [lon, lat] の順序に変換
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
      if (m.getLayer("paths-layer")) m.removeLayer("paths-layer");
      if (m.getLayer("paths-layer-hitbox")) m.removeLayer("paths-layer-hitbox"); // ヒットボックスレイヤーも削除
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

      // メインのパスレイヤー
      m.addLayer({
        id: "paths-layer",
        type: "line",
        source: "paths-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#829DFF",
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
          "line-opacity": 0.8,
        },
      });

      // 透明なヒットボックスレイヤー
      m.addLayer({
        id: "paths-layer-hitbox",
        type: "line",
        source: "paths-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "rgba(0, 0, 0, 0)", // 完全に透明
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            20,
            16,
            30,
            20,
            40,
          ],
        },
      });

      // 透明レイヤーにクリックイベントを追加
      m.on("click", "paths-layer-hitbox", e => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        if (onSelectPath) {
          onSelectPath(feature.properties as Path);
        }
      });

      // ホバー時のスタイリング
      m.on("mouseenter", "paths-layer-hitbox", () => {
        m.getCanvas().style.cursor = "pointer";
      });

      m.on("mouseleave", "paths-layer-hitbox", () => {
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
      center: [138.7273, 35.3606], // 富士山の座標
      zoom: 10, // 初期ズームレベルを低めに設定
      pitch: 0,
      bearing: 0,
      maxBounds: [
        [122.93457, 24.396308], // 南西端 (沖縄付近)
        [153.986672, 45.551483], // 北東端 (北海道付近)
      ], // ✨ 日本の範囲に限定
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

    map.current.on("load", () => {
      addDemAndTerrain();
      addOrUpdatePaths();
      addOrUpdateMountains();

      // ✨ 初回ロード時に富士山にズームインするアニメーションを追加
      map.current?.flyTo({
        center: [138.7273, 35.3606], // 富士山の座標
        zoom: 12, // ズームイン後のズームレベル
        pitch: 60, // 3D効果を追加
        bearing: 30, // 斜めの視点
        duration: 3000, // アニメーションの時間（ミリ秒）
      });

      handleMapMove();
    });

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
        zoom = Math.min(m.getZoom(), 14); // 現在のズームレベルを考慮
      } else if (elevation >= 2000) {
        zoom = Math.min(m.getZoom(), 15);
      } else if (elevation >= 1000) {
        zoom = Math.min(m.getZoom(), 16);
      } else {
        zoom = Math.min(m.getZoom(), 17);
      }

      // 標高に応じたピッチとベアリングの調整
      const pitch =
        elevation >= 3000
          ? 70
          : elevation >= 2000
            ? 65
            : elevation >= 1000
              ? 60
              : 45;
      const bearing =
        elevation >= 3000
          ? 45
          : elevation >= 2000
            ? 30
            : elevation >= 1000
              ? 15
              : 0;

      // アニメーション時間を調整
      const duration =
        elevation >= 3000 ? 2000 : elevation >= 2000 ? 1800 : 1500;

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

  // ✨ hoveredPointが変更されたときにマーカーを表示/更新/削除
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    // 既存のマーカーを削除
    if (hoveredPointMarker.current) {
      hoveredPointMarker.current.remove();
      hoveredPointMarker.current = null;
    }

    // hoveredPointが存在する場合は新しいマーカーを追加
    if (hoveredPoint) {
      // カスタムマーカー要素を作成
      const el = document.createElement("div");
      el.className = "hovered-point-marker";
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#ff4444";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";

      // マーカーを作成して地図に追加
      hoveredPointMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([hoveredPoint.lon, hoveredPoint.lat])
        .addTo(m);
    }
  }, [hoveredPoint]);

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

  const resetNorth = useCallback(() => {
    const m = map.current;
    if (!m) return;

    m.easeTo({ bearing: 0 }); // 地図を北方向に向ける
  }, []);

  // 矩形選択モードのトグル
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => !prev);
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  }, []);

  // 矩形選択モード時にマップのドラッグを無効化
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (isSelectMode) {
      // 矩形選択モード: マップのドラッグを無効化
      m.dragPan.disable();
      m.dragRotate.disable();
      m.touchZoomRotate.disableRotation();
    } else {
      // 通常モード: マップのドラッグを有効化
      m.dragPan.enable();
      m.dragRotate.enable();
      m.touchZoomRotate.enableRotation();
    }
  }, [isSelectMode]);

  // マウスダウン: 矩形選択開始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSelectMode || !mapContainer.current) return;

      // マップの操作を防ぐためにイベントの伝播を止める
      e.preventDefault();
      e.stopPropagation();

      const rect = mapContainer.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsDrawing(true);
      setStartPoint({ x, y });
      setCurrentPoint({ x, y });
    },
    [isSelectMode],
  );

  // マウスムーブ: 矩形を描画
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawing || !mapContainer.current) return;

      // マップの操作を防ぐためにイベントの伝播を止める
      e.preventDefault();
      e.stopPropagation();

      const rect = mapContainer.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setCurrentPoint({ x, y });
    },
    [isDrawing],
  );

  // マウスアップ: 矩形選択完了
  const handleMouseUp = useCallback(async () => {
    if (!isDrawing || !startPoint || !currentPoint || !map.current) {
      setIsDrawing(false);
      return;
    }

    const m = map.current;

    // ピクセル座標を地理座標に変換
    const startLngLat = m.unproject([startPoint.x, startPoint.y]);
    const endLngLat = m.unproject([currentPoint.x, currentPoint.y]);

    const minLon = Math.min(startLngLat.lng, endLngLat.lng);
    const maxLon = Math.max(startLngLat.lng, endLngLat.lng);
    const minLat = Math.min(startLngLat.lat, endLngLat.lat);
    const maxLat = Math.max(startLngLat.lat, endLngLat.lat);

    // 状態をリセット
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);

    // 削除確認
    if (onDeletePaths) {
      const confirmed = window.confirm(
        `選択した範囲内のパスを削除しますか？\n範囲: (${minLat.toFixed(4)}, ${minLon.toFixed(4)}) - (${maxLat.toFixed(4)}, ${maxLon.toFixed(4)})`,
      );

      if (confirmed) {
        try {
          await onDeletePaths({ minLat, minLon, maxLat, maxLon });
          alert("パスの削除が完了しました");
        } catch (error) {
          console.error("削除エラー:", error);
          alert("パスの削除に失敗しました");
        }
      }
    }
  }, [isDrawing, startPoint, currentPoint, onDeletePaths]);

  return (
    <div className="relative w-full h-full">
      {/* 矩形選択用のオーバーレイ */}
      {isSelectMode && (
        // biome-ignore lint/a11y/noStaticElementInteractions: This is an overlay for rectangle selection, keyboard interaction is handled by the toggle button
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isDrawing) {
              setIsDrawing(false);
              setStartPoint(null);
              setCurrentPoint(null);
            }
          }}
        />
      )}

      <div ref={mapContainer} className="w-full h-full" />

      {/* 矩形選択の視覚化 */}
      {isDrawing && startPoint && currentPoint && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: Math.min(startPoint.x, currentPoint.x),
            top: Math.min(startPoint.y, currentPoint.y),
            width: Math.abs(currentPoint.x - startPoint.x),
            height: Math.abs(currentPoint.y - startPoint.y),
            border: "3px solid #ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.25)",
            boxShadow:
              "0 0 0 2px rgba(255, 255, 255, 0.8), 0 4px 12px rgba(0, 0, 0, 0.3)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        >
          {/* 選択範囲の四隅にコーナーマーカー */}
          <div className="absolute top-0 left-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full -translate-x-1/2 translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full translate-x-1/2 translate-y-1/2" />

          {/* 選択範囲のサイズ表示 */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg whitespace-nowrap">
            {Math.abs(currentPoint.x - startPoint.x).toFixed(0)}px ×{" "}
            {Math.abs(currentPoint.y - startPoint.y).toFixed(0)}px
          </div>
        </div>
      )}
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

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.85;
          }
        }
      `}</style>
      {/* ✨ ボタンコンテナ */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleSelectMode}
          className={`cursor-pointer flex items-center justify-center w-9 h-9 border rounded shadow transition-colors ${
            isSelectMode
              ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
          }`}
          title={isSelectMode ? "矩形選択モードを終了" : "矩形選択モードを開始"}
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
            aria-label={
              isSelectMode ? "矩形選択モードを終了" : "矩形選択モードを開始"
            }
          >
            <title>
              {isSelectMode ? "矩形選択モードを終了" : "矩形選択モードを開始"}
            </title>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
        </button>
        <button
          type="button"
          onClick={resetNorth}
          className="cursor-pointer flex items-center justify-center w-9 h-9 bg-white border border-gray-300 rounded shadow hover:bg-gray-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            className="w-6 h-6"
          >
            <title>Reset North</title>
            <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM370.7 389.1L226.4 444.6C207 452.1 187.9 433 195.4 413.6L250.9 269.3C254.2 260.8 260.8 254.2 269.3 250.9L413.6 195.4C433 187.9 452.1 207 444.6 226.4L389.1 370.7C385.9 379.2 379.2 385.8 370.7 389.1zM352 320C352 302.3 337.7 288 320 288C302.3 288 288 302.3 288 320C288 337.7 302.3 352 320 352C337.7 352 352 337.7 352 320z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => map.current?.zoomIn()}
          className="cursor-pointer flex items-center justify-center w-9 h-9 bg-white border border-gray-300 rounded shadow hover:bg-gray-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            className="w-6 h-6"
          >
            <title>Zoom In</title>
            <path d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => map.current?.zoomOut()}
          className="cursor-pointer flex items-center justify-center w-9 h-9 bg-white border border-gray-300 rounded shadow hover:bg-gray-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            className="w-6 h-6"
          >
            <title>Zoom Out</title>
            <path d="M96 320C96 302.3 110.3 288 128 288L512 288C529.7 288 544 302.3 544 320C544 337.7 529.7 352 512 352L128 352C110.3 352 96 337.7 96 320z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggle2D3D}
          className="cursor-pointer flex items-center justify-center w-9 h-9 bg-white border border-gray-300 rounded shadow hover:bg-gray-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            className="w-6 h-6"
          >
            <title>Toggle 2D/3D View</title>
            <path d="M288.3 61.5C308.1 50.1 332.5 50.1 352.3 61.5L528.2 163C548 174.4 560.2 195.6 560.2 218.4L560.2 421.4C560.2 444.3 548 465.4 528.2 476.8L352.3 578.5C332.5 589.9 308.1 589.9 288.3 578.5L112.5 477C92.7 465.6 80.5 444.4 80.5 421.6L80.5 218.6C80.5 195.7 92.7 174.6 112.5 163.2L288.3 61.5zM496.1 421.5L496.1 255.4L352.3 338.4L352.3 504.5L496.1 421.5z" />
          </svg>
        </button>
      </div>
      {/* ✨ 凡例コンテナ */}
      <div className="absolute top-20 left-2 z-10 bg-white bg-opacity-90 rounded shadow p-3 text-sm">
        <h3 className="font-bold mb-2">凡例</h3>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #ff6b6b, #ff8e53, #ff6b9d, #845ec2, #4e8fdf)",
              border: "2px solid #ffffff",
            }}
          ></div>
          <span>山頂（標高に応じた色）</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-1"
            style={{
              backgroundColor: "#15A34C",
              opacity: 0.7,
            }}
          ></div>
          <span>登山道</span>
        </div>
      </div>
    </div>
  );
};
