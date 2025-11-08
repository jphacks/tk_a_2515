"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { renderToString } from "react-dom/server";
import type {
  BearSighting,
  Mountain,
  Path,
  PathDetail,
} from "@/app/api/lib/models";
import { MountainTooltip } from "./MountainTooltip";

// 山とパスを表示するズームレベルの閾値
export const ZOOM_LEVEL_THRESHOLD = 11;

type StyleMode = "hybrid" | "normal";

interface Props {
  styleMode?: StyleMode;
  mountains: Mountain[];
  paths: Path[];
  bears: BearSighting[];
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
  onSelectBear?: (bear: BearSighting) => void;
  selectedPath?: PathDetail | null;
  selectedBear?: BearSighting | null;
  hoveredPoint?: { lat: number; lon: number } | null;
}

export const MapTerrain = ({
  styleMode = "hybrid",
  mountains,
  paths,
  bears,
  onBoundsChange,
  onSelectMountain,
  selectedMountain,
  selectedBear,
  onSelectPath,
  onSelectBear,
  hoveredPoint,
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

  // マップとコンポーネントの状態管理用ref
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const currentMode = useRef<StyleMode>(styleMode);
  const hoveredPointMarker = useRef<maplibregl.Marker | null>(null);
  const pathsListenersRegistered = useRef<boolean>(false);
  const mountainsListenersRegistered = useRef<boolean>(false);
  const bearsListenersRegistered = useRef<boolean>(false);
  const pathsRef = useRef<Path[]>(paths);
  const mountainsRef = useRef<Mountain[]>(mountains);
  const bearsRef = useRef<BearSighting[]>(bears);
  const previousPathsHash = useRef<string>("");
  const previousMountainsHash = useRef<string>("");
  const isMountedRef = useRef<boolean>(true);
  const animationFrameIdsRef = useRef<Set<number>>(new Set());
  const selectedPathIdRef = useRef<number | null>(null);
  const selectedMountainIdRef = useRef<number | null>(null);
  const selectedBearIdRef = useRef<number | null>(null);
  const geolocateControl = useRef<maplibregl.GeolocateControl | null>(null);

  // イベントハンドラーの参照を保持（クリーンアップ用）
  const mountainsEventHandlers = useRef<{
    handleClick?: (
      e: maplibregl.MapMouseEvent & {
        features?: maplibregl.MapGeoJSONFeature[];
      },
    ) => void;
    handleMouseEnter?: (
      e: maplibregl.MapMouseEvent & {
        features?: maplibregl.MapGeoJSONFeature[];
      },
    ) => void;
    handleMouseLeave?: () => void;
  }>({});

  const pathsEventHandlers = useRef<{
    handleClick?: (
      e: maplibregl.MapMouseEvent & {
        features?: maplibregl.MapGeoJSONFeature[];
      },
    ) => void;
    handleMouseEnter?: () => void;
    handleMouseLeave?: () => void;
  }>({});

  const bearsEventHandlers = useRef<{
    handleClick?: (
      e: maplibregl.MapMouseEvent & {
        features?: maplibregl.MapGeoJSONFeature[];
      },
    ) => void;
    handleMouseEnter?: (
      e: maplibregl.MapMouseEvent & {
        features?: maplibregl.MapGeoJSONFeature[];
      },
    ) => void;
    handleMouseLeave?: () => void;
  }>({});

  // データ変更検知用のハッシュ値を生成
  const pathsHash = useMemo((): string => {
    if (!paths || paths.length === 0) return "empty";
    return paths
      .map(p => {
        const geomCount = p.geometries?.length || 0;
        const firstGeom = p.geometries?.[0];
        const lastGeom = p.geometries?.[geomCount - 1];
        return `${p.id}-${geomCount}-${firstGeom?.lon || ""}-${firstGeom?.lat || ""}-${lastGeom?.lon || ""}-${lastGeom?.lat || ""}`;
      })
      .sort()
      .join("|");
  }, [paths]);

  const mountainsHash = useMemo((): string => {
    if (!mountains || mountains.length === 0) return "empty";
    return mountains
      .map(m => `${m.id}-${m.lon}-${m.lat}-${m.elevation}`)
      .sort()
      .join("|");
  }, [mountains]);

  // 最新のデータへの参照を保持
  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  useEffect(() => {
    mountainsRef.current = mountains;
  }, [mountains]);

  useEffect(() => {
    bearsRef.current = bears;
  }, [bears]);

  // 地形タイルとDEMを追加
  const addDemAndTerrain = useCallback(() => {
    const m = map.current;
    if (!m) return;
    if (!m.getSource("maptiler-dem")) {
      m.addSource("maptiler-dem", { type: "raster-dem", url: demTilesJsonUrl });
    }
    m.setTerrain({ source: "maptiler-dem", exaggeration: 1.5 });
  }, [demTilesJsonUrl]);

  // パスのイベントリスナーをクリーンアップ
  const cleanupPathsListeners = useCallback(() => {
    const m = map.current;
    if (!m || !pathsListenersRegistered.current) return;

    if (pathsEventHandlers.current.handleClick) {
      m.off(
        "click",
        "paths-layer-hitbox",
        pathsEventHandlers.current.handleClick,
      );
    }
    if (pathsEventHandlers.current.handleMouseEnter) {
      m.off(
        "mouseenter",
        "paths-layer-hitbox",
        pathsEventHandlers.current.handleMouseEnter,
      );
    }
    if (pathsEventHandlers.current.handleMouseLeave) {
      m.off(
        "mouseleave",
        "paths-layer-hitbox",
        pathsEventHandlers.current.handleMouseLeave,
      );
    }
    pathsEventHandlers.current = {};
    pathsListenersRegistered.current = false;
  }, []);

  // 山のイベントリスナーをクリーンアップ
  const cleanupMountainsListeners = useCallback(() => {
    const m = map.current;
    if (!m || !mountainsListenersRegistered.current) return;

    if (mountainsEventHandlers.current.handleClick) {
      m.off(
        "click",
        "mountains-points",
        mountainsEventHandlers.current.handleClick,
      );
      m.off(
        "click",
        "mountains-labels",
        mountainsEventHandlers.current.handleClick,
      );
    }
    if (mountainsEventHandlers.current.handleMouseEnter) {
      m.off(
        "mouseenter",
        "mountains-points",
        mountainsEventHandlers.current.handleMouseEnter,
      );
      m.off(
        "mouseenter",
        "mountains-labels",
        mountainsEventHandlers.current.handleMouseEnter,
      );
    }
    if (mountainsEventHandlers.current.handleMouseLeave) {
      m.off(
        "mouseleave",
        "mountains-points",
        mountainsEventHandlers.current.handleMouseLeave,
      );
      m.off(
        "mouseleave",
        "mountains-labels",
        mountainsEventHandlers.current.handleMouseLeave,
      );
    }
    mountainsEventHandlers.current = {};
    mountainsListenersRegistered.current = false;
  }, []);

  // クマのイベントリスナーをクリーンアップ
  const cleanupBearsListeners = useCallback(() => {
    const m = map.current;
    if (!m || !bearsListenersRegistered.current) return;

    if (bearsEventHandlers.current.handleClick) {
      m.off("click", "bears-points", bearsEventHandlers.current.handleClick);
    }
    if (bearsEventHandlers.current.handleMouseEnter) {
      m.off(
        "mouseenter",
        "bears-points",
        bearsEventHandlers.current.handleMouseEnter,
      );
    }
    if (bearsEventHandlers.current.handleMouseLeave) {
      m.off(
        "mouseleave",
        "bears-points",
        bearsEventHandlers.current.handleMouseLeave,
      );
    }
    bearsEventHandlers.current = {};
    bearsListenersRegistered.current = false;
  }, []);

  // パスデータをGeoJSON形式に変換
  const pathsGeoJSON = useMemo((): GeoJSON.FeatureCollection => {
    const features = paths.map((path, _) => {
      const geometries = path.geometries || [];
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
          ]),
        },
      };
    });

    return {
      type: "FeatureCollection",
      features,
    };
  }, [paths]);

  // パスのレイヤーを追加または更新
  const addOrUpdatePaths = useCallback(() => {
    const m = map.current;
    if (!m || !isMountedRef.current) return;

    // ズームレベルが閾値未満の場合はレイヤーを削除
    if (m.getZoom() < ZOOM_LEVEL_THRESHOLD) {
      cleanupPathsListeners();
      if (m.getLayer("paths-layer-selected"))
        m.removeLayer("paths-layer-selected");
      if (m.getLayer("paths-layer-hitbox")) m.removeLayer("paths-layer-hitbox");
      if (m.getLayer("paths-layer")) m.removeLayer("paths-layer");
      if (m.getSource("paths-source")) m.removeSource("paths-source");
      return;
    }

    // イベントリスナーを登録するヘルパー関数
    const registerPathsEventListeners = () => {
      if (
        !onSelectPath ||
        pathsListenersRegistered.current ||
        !m.getLayer("paths-layer-hitbox")
      ) {
        return;
      }

      // クリックイベント: パスを選択
      const handleClick = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        const pathId = feature.properties?.id;

        // 選択されたパスIDを更新
        selectedPathIdRef.current = pathId;

        // 選択されたパスレイヤーのフィルターを更新
        if (m.getLayer("paths-layer-selected")) {
          m.setFilter("paths-layer-selected", ["==", ["get", "id"], pathId]);
        }

        if (onSelectPath) {
          onSelectPath(feature.properties as Path);
        }
      };

      // マウスエンターイベント: カーソルをポインターに変更
      const handleMouseEnter = () => {
        m.getCanvas().style.cursor = "pointer";
      };

      // マウスリーブイベント: カーソルをデフォルトに戻す
      const handleMouseLeave = () => {
        m.getCanvas().style.cursor = "";
      };

      pathsEventHandlers.current = {
        handleClick,
        handleMouseEnter,
        handleMouseLeave,
      };

      m.on("click", "paths-layer-hitbox", handleClick);
      m.on("mouseenter", "paths-layer-hitbox", handleMouseEnter);
      m.on("mouseleave", "paths-layer-hitbox", handleMouseLeave);

      pathsListenersRegistered.current = true;
    };

    const source = m.getSource("paths-source") as maplibregl.GeoJSONSource;

    // ソースが既に存在する場合はデータのみ更新
    if (source) {
      source.setData(pathsGeoJSON);
      registerPathsEventListeners();

      // 選択されたパスのフィルターを再適用
      if (
        m.getLayer("paths-layer-selected") &&
        selectedPathIdRef.current !== null
      ) {
        m.setFilter("paths-layer-selected", [
          "==",
          ["get", "id"],
          selectedPathIdRef.current,
        ]);
      }
      return;
    }

    // ソースとレイヤーを新規追加
    m.addSource("paths-source", {
      type: "geojson",
      data: pathsGeoJSON,
    });

    // 視覚的なパスレイヤー（通常）
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
      filter: ["!=", ["get", "id"], selectedPathIdRef.current ?? -1],
    });

    // 選択されたパスレイヤー（目立つ色）
    m.addLayer({
      id: "paths-layer-selected",
      type: "line",
      source: "paths-source",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#FF6B35",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          6,
          16,
          9,
          20,
          12,
        ],
        "line-opacity": 0.9,
      },
      filter: ["==", ["get", "id"], selectedPathIdRef.current ?? -1],
    });

    // クリック判定用の透明なヒットボックスレイヤー
    m.addLayer({
      id: "paths-layer-hitbox",
      type: "line",
      source: "paths-source",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "rgba(0, 0, 0, 0)",
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

    registerPathsEventListeners();
  }, [pathsGeoJSON, onSelectPath, cleanupPathsListeners]);

  // 山データをGeoJSON形式に変換
  const mountainsGeoJSON = useMemo((): GeoJSON.FeatureCollection => {
    const features = mountains
      .filter(
        mountain =>
          mountain.lon !== null &&
          mountain.lon !== undefined &&
          mountain.lat !== null &&
          mountain.lat !== undefined,
      )
      .map(mountain => ({
        type: "Feature" as const,
        properties: {
          id: mountain.id,
          name: mountain.name,
          elevation: mountain.elevation,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [mountain.lon, mountain.lat] as [number, number],
        },
      }));
    return {
      type: "FeatureCollection",
      features,
    };
  }, [mountains]);

  // 山のレイヤーを追加または更新
  const addOrUpdateMountains = useCallback(() => {
    const m = map.current;
    if (!m || !isMountedRef.current) return;

    // ズームレベルが閾値未満の場合はレイヤーを削除
    if (m.getZoom() < ZOOM_LEVEL_THRESHOLD) {
      cleanupMountainsListeners();
      if (m.getLayer("mountains-labels")) m.removeLayer("mountains-labels");
      if (m.getLayer("mountains-points-selected"))
        m.removeLayer("mountains-points-selected");
      if (m.getLayer("mountains-points-hover"))
        m.removeLayer("mountains-points-hover");
      if (m.getLayer("mountains-points")) m.removeLayer("mountains-points");
      if (m.getLayer("mountains-points-shadow"))
        m.removeLayer("mountains-points-shadow");
      if (m.getSource("mountains-source")) m.removeSource("mountains-source");
      return;
    }

    // イベントリスナーを登録するヘルパー関数
    const registerMountainsEventListeners = () => {
      if (
        !onSelectMountain ||
        mountainsListenersRegistered.current ||
        !m.getLayer("mountains-points")
      ) {
        return;
      }

      // クリックイベント: ポップアップを表示
      const handleClick = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        if (!e.features || !e.features[0]) return;

        // 既存のポップアップを削除
        const existingPopups = document.querySelectorAll(".maplibregl-popup");
        for (const popup of existingPopups) {
          popup.remove();
        }

        const feature = e.features[0];
        if (feature.geometry.type !== "Point") return;
        const coordinates = feature.geometry.coordinates.slice();
        const { name, elevation, id } = feature.properties || {};

        // 選択された山のIDを更新
        selectedMountainIdRef.current = id;

        // 選択された山レイヤーのフィルターを更新
        if (m.getLayer("mountains-points-selected")) {
          m.setFilter("mountains-points-selected", ["==", ["get", "id"], id]);
        }

        // 最新のデータから山情報を取得
        const latestMountains = mountainsRef.current;
        const selectedMountain = latestMountains.find(m => m.id === id);

        const tooltipHtml = renderToString(
          <MountainTooltip name={name} elevation={elevation} />,
        );

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

        // 詳細ボタンのイベントリスナーを追加
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

        const closeButton = popup
          .getElement()
          ?.querySelector(".maplibregl-popup-close-button");
        if (closeButton) {
          closeButton.addEventListener("click", () => {
            popup.remove();
          });
        }
      };

      // マウスエンターイベント: ホバーレイヤーを表示
      const handleMouseEnter = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        m.getCanvas().style.cursor = "pointer";
        if (e.features?.[0]) {
          const featureId = e.features[0].properties?.id;
          m.setFilter("mountains-points-hover", [
            "==",
            ["get", "id"],
            featureId,
          ]);
        }
      };

      // マウスリーブイベント: ホバーレイヤーを非表示
      const handleMouseLeave = () => {
        m.getCanvas().style.cursor = "";
        m.setFilter("mountains-points-hover", ["==", ["get", "id"], ""]);
      };

      mountainsEventHandlers.current = {
        handleClick,
        handleMouseEnter,
        handleMouseLeave,
      };

      // ピンレイヤーとラベルレイヤーの両方にイベントを登録
      m.on("click", "mountains-points", handleClick);
      m.on("mouseenter", "mountains-points", handleMouseEnter);
      m.on("mouseleave", "mountains-points", handleMouseLeave);

      // ラベルレイヤーにもイベントを登録
      m.on("click", "mountains-labels", handleClick);
      m.on("mouseenter", "mountains-labels", handleMouseEnter);
      m.on("mouseleave", "mountains-labels", handleMouseLeave);

      mountainsListenersRegistered.current = true;
    };

    const source = m.getSource("mountains-source") as maplibregl.GeoJSONSource;

    // ソースが既に存在する場合はデータのみ更新
    if (source) {
      source.setData(mountainsGeoJSON);
      registerMountainsEventListeners();

      // 選択された山のフィルターを再適用
      if (
        m.getLayer("mountains-points-selected") &&
        selectedMountainIdRef.current !== null
      ) {
        m.setFilter("mountains-points-selected", [
          "==",
          ["get", "id"],
          selectedMountainIdRef.current,
        ]);
      }
      return;
    }

    // スタイルがロードされていない場合は次のフレームで再試行
    if (!m.isStyleLoaded()) {
      const frameId = requestAnimationFrame(() => {
        animationFrameIdsRef.current.delete(frameId);
        if (isMountedRef.current && map.current) {
          addOrUpdateMountains();
        }
      });
      animationFrameIdsRef.current.add(frameId);
      return;
    }

    // レイヤー追加時のエラーハンドリング
    try {
      m.addSource("mountains-source", {
        type: "geojson",
        data: mountainsGeoJSON,
      });

      // 影レイヤー
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

      // メインの山ピンレイヤー（標高に応じた色分け）
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
        filter: ["!=", ["get", "id"], selectedMountainIdRef.current ?? -1],
      });

      // 選択された山専用のレイヤー（大きく目立つ）
      m.addLayer({
        id: "mountains-points-selected",
        type: "circle",
        source: "mountains-source",
        paint: {
          "circle-color": "#ffea71ff",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            8,
            16,
            13,
            20,
            19,
          ],
          "circle-stroke-color": "#FF4500",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            2,
            16,
            4,
            20,
            6,
          ],
          "circle-opacity": 1,
          "circle-stroke-opacity": 1,
        },
        filter: ["==", ["get", "id"], selectedMountainIdRef.current ?? -1],
      });

      // ホバー時に表示する拡大レイヤー
      m.addLayer({
        id: "mountains-points-hover",
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
            7,
            16,
            10,
            20,
            14,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            3,
            16,
            4,
            20,
            5,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-opacity": 1,
        },
        filter: ["==", ["get", "id"], ""],
      });

      registerMountainsEventListeners();
    } catch (error) {
      console.error("[MapTerrain] Error adding mountains layers:", error);
      // エラー時は次のフレームで再試行
      const frameId = requestAnimationFrame(() => {
        animationFrameIdsRef.current.delete(frameId);
        if (isMountedRef.current && map.current) {
          addOrUpdateMountains();
        }
      });
      animationFrameIdsRef.current.add(frameId);
      return;
    }
  }, [mountainsGeoJSON, onSelectMountain, cleanupMountainsListeners]);

  // クマデータをGeoJSON形式に変換（山のパターンを完全に模倣）
  const bearsGeoJSON = useMemo((): GeoJSON.FeatureCollection => {
    const features = bears
      .filter(
        bear =>
          bear.longitude !== null &&
          bear.longitude !== undefined &&
          bear.latitude !== null &&
          bear.latitude !== undefined,
      )
      .map(bear => ({
        type: "Feature" as const,
        properties: {
          id: bear.id,
          prefecture: bear.prefecture,
          city: bear.city,
          summary: bear.summary,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [bear.longitude, bear.latitude] as [number, number],
        },
      }));
    return {
      type: "FeatureCollection",
      features,
    };
  }, [bears]);

  // クマのレイヤーを追加または更新（山のパターンを完全に模倣）
  const addOrUpdateBears = useCallback(() => {
    const m = map.current;
    if (!m || !isMountedRef.current) return;

    // イベントリスナーを登録するヘルパー関数
    const registerBearsEventListeners = () => {
      if (
        !onSelectBear ||
        bearsListenersRegistered.current ||
        !m.getLayer("bears-points")
      ) {
        return;
      }

      // クリックイベント: クマ情報を選択
      const handleClick = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        const bearId = feature.properties?.id;

        // 選択されたクマのIDを更新
        selectedBearIdRef.current = bearId;

        // 選択されたクマレイヤーのフィルターを更新
        if (m.getLayer("bears-points-selected")) {
          m.setFilter("bears-points-selected", ["==", ["get", "id"], bearId]);
        }

        // 最新のデータからクマ情報を取得
        const latestBears = bearsRef.current;
        const selectedBear = latestBears.find(b => b.id === bearId);

        if (selectedBear && onSelectBear) {
          onSelectBear(selectedBear);
        }
      };

      // マウスエンターイベント: ホバーレイヤーを表示
      const handleMouseEnter = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        m.getCanvas().style.cursor = "pointer";
        if (e.features?.[0]) {
          const featureId = e.features[0].properties?.id;
          m.setFilter("bears-points-hover", ["==", ["get", "id"], featureId]);
        }
      };

      // マウスリーブイベント: ホバーレイヤーを非表示
      const handleMouseLeave = () => {
        m.getCanvas().style.cursor = "";
        m.setFilter("bears-points-hover", ["==", ["get", "id"], ""]);
      };

      bearsEventHandlers.current = {
        handleClick,
        handleMouseEnter,
        handleMouseLeave,
      };

      // ピンレイヤーにイベントを登録
      m.on("click", "bears-points", handleClick);
      m.on("mouseenter", "bears-points", handleMouseEnter);
      m.on("mouseleave", "bears-points", handleMouseLeave);

      bearsListenersRegistered.current = true;
    };

    const source = m.getSource("bears-source") as maplibregl.GeoJSONSource;

    // ソースが既に存在する場合はデータのみ更新
    if (source) {
      source.setData(bearsGeoJSON);
      registerBearsEventListeners();

      // 選択されたクマのフィルターを再適用
      if (
        m.getLayer("bears-points-selected") &&
        selectedBearIdRef.current !== null
      ) {
        m.setFilter("bears-points-selected", [
          "==",
          ["get", "id"],
          selectedBearIdRef.current,
        ]);
      }
      return;
    }

    // スタイルがロードされていない場合は次のフレームで再試行
    if (!m.isStyleLoaded()) {
      const frameId = requestAnimationFrame(() => {
        animationFrameIdsRef.current.delete(frameId);
        if (isMountedRef.current && map.current) {
          addOrUpdateBears();
        }
      });
      animationFrameIdsRef.current.add(frameId);
      return;
    }

    // レイヤー追加時のエラーハンドリング
    try {
      m.addSource("bears-source", {
        type: "geojson",
        data: bearsGeoJSON,
      });

      // 影レイヤー
      m.addLayer({
        id: "bears-points-shadow",
        type: "circle",
        source: "bears-source",
        paint: {
          "circle-color": "rgba(0, 0, 0, 0.3)",
          "circle-radius": 8,
          "circle-translate": [2, 2],
          "circle-blur": 0.5,
        },
      });

      // メインのクマピンレイヤー
      m.addLayer({
        id: "bears-points",
        type: "circle",
        source: "bears-source",
        paint: {
          "circle-color": "#D97706",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            4,
            12,
            6,
            16,
            8,
            20,
            10,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            1,
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
        filter: ["!=", ["get", "id"], selectedBearIdRef.current ?? -1],
      });

      // 選択されたクマ専用のレイヤー（大きく目立つ）
      m.addLayer({
        id: "bears-points-selected",
        type: "circle",
        source: "bears-source",
        paint: {
          "circle-color": "#FCD34D",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            7,
            12,
            10,
            16,
            14,
            20,
            18,
          ],
          "circle-stroke-color": "#D97706",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            2,
            12,
            3,
            16,
            5,
            20,
            7,
          ],
          "circle-opacity": 1,
          "circle-stroke-opacity": 1,
        },
        filter: ["==", ["get", "id"], selectedBearIdRef.current ?? -1],
      });

      // ホバー時に表示する拡大レイヤー
      m.addLayer({
        id: "bears-points-hover",
        type: "circle",
        source: "bears-source",
        paint: {
          "circle-color": "#D97706",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            6,
            12,
            8,
            16,
            11,
            20,
            14,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            2,
            12,
            3,
            16,
            4,
            20,
            5,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-opacity": 1,
        },
        filter: ["==", ["get", "id"], ""],
      });

      registerBearsEventListeners();
    } catch (error) {
      console.error("[MapTerrain] Error adding bears layers:", error);
      // エラー時は次のフレームで再試行
      const frameId = requestAnimationFrame(() => {
        animationFrameIdsRef.current.delete(frameId);
        if (isMountedRef.current && map.current) {
          addOrUpdateBears();
        }
      });
      animationFrameIdsRef.current.add(frameId);
      return;
    }
  }, [bearsGeoJSON, onSelectBear]);

  // マップの初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化は一度だけ実行
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrls[styleMode],
      center: [138.7273, 35.3606],
      zoom: 10,
      pitch: 0,
      bearing: 0,
      maxBounds: [
        [122.93457, 24.396308],
        [153.986672, 45.551483],
      ],
      transformRequest: url => {
        const maptilerUrl = "https://api.maptiler.com/";
        if (url.startsWith(maptilerUrl)) {
          const pathAndQuery = url.substring(maptilerUrl.length);
          const [path, query] = pathAndQuery.includes("?")
            ? pathAndQuery.split("?")
            : [pathAndQuery, ""];

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

    // GeolocateControlを作成
    geolocateControl.current = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
    });

    // マップ移動時の処理
    const handleMapMove = () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      const center = map.current.getCenter();
      const fullWidth = bounds.getEast() - bounds.getWest();
      const fullHeight = bounds.getNorth() - bounds.getSouth();

      // マップ中央70%の領域を計算
      const targetRatio = 0.7;
      const halfWidth = (fullWidth * targetRatio) / 2;
      const halfHeight = (fullHeight * targetRatio) / 2;
      const newBounds = {
        minLon: center.lng - halfWidth,
        minLat: center.lat - halfHeight,
        maxLon: center.lng + halfWidth,
        maxLat: center.lat + halfHeight,
      };

      const zoomLevel = map.current.getZoom();

      if (zoomLevel < ZOOM_LEVEL_THRESHOLD) {
        // ズームレベルが閾値未満の場合、リスナーとレイヤーをクリーンアップ
        cleanupPathsListeners();
        cleanupMountainsListeners();

        if (map.current.getLayer("mountains-labels"))
          map.current.removeLayer("mountains-labels");
        if (map.current.getLayer("mountains-points-selected"))
          map.current.removeLayer("mountains-points-selected");
        if (map.current.getLayer("mountains-points-hover"))
          map.current.removeLayer("mountains-points-hover");
        if (map.current.getLayer("mountains-points"))
          map.current.removeLayer("mountains-points");
        if (map.current.getLayer("mountains-points-shadow"))
          map.current.removeLayer("mountains-points-shadow");
        if (map.current.getSource("mountains-source"))
          map.current.removeSource("mountains-source");
        if (map.current.getLayer("paths-layer-selected"))
          map.current.removeLayer("paths-layer-selected");
        if (map.current.getLayer("paths-layer-hitbox"))
          map.current.removeLayer("paths-layer-hitbox");
        if (map.current.getLayer("paths-layer"))
          map.current.removeLayer("paths-layer");
        if (map.current.getSource("paths-source"))
          map.current.removeSource("paths-source");
      } else {
        // ズームレベルが閾値以上の場合、レイヤーを更新
        addOrUpdatePaths();
        addOrUpdateMountains();
        addOrUpdateBears();
      }

      // バウンディングボックスの変更を通知
      if (onBoundsChange) {
        onBoundsChange({ ...newBounds, zoomLevel });
      }
    };

    // ズーム時の処理
    const handleZoom = () => {
      if (!map.current) return;
      const zoomLevel = map.current.getZoom();

      if (zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
        addOrUpdatePaths();
        addOrUpdateMountains();
      }
      addOrUpdateBears();
    };

    // ピッチ変更時の処理
    const handlePitch = () => {
      if (!map.current) return;
      const zoomLevel = map.current.getZoom();

      if (zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
        addOrUpdatePaths();
        addOrUpdateMountains();
      }
      addOrUpdateBears();
    };

    map.current.on("load", () => {
      addDemAndTerrain();
      addOrUpdatePaths();
      addOrUpdateMountains();
      addOrUpdateBears();

      // GeolocateControlを追加
      if (geolocateControl.current && map.current) {
        map.current.addControl(geolocateControl.current);
      }

      // 初期カメラアニメーション
      map.current?.flyTo({
        center: [138.7273, 35.3606],
        zoom: 12,
        pitch: 60,
        bearing: 30,
        duration: 3000,
      });

      handleMapMove();
    });

    map.current.on("moveend", handleMapMove);
    map.current.on("zoomend", handleZoom);
    map.current.on("pitchend", handlePitch);

    // クリーンアップ
    return () => {
      isMountedRef.current = false;

      // 保留中のアニメーションフレームをキャンセル
      for (const frameId of animationFrameIdsRef.current) {
        cancelAnimationFrame(frameId);
      }
      animationFrameIdsRef.current.clear();

      const m = map.current;
      if (m) {
        cleanupPathsListeners();
        cleanupMountainsListeners();
        cleanupBearsListeners();
      }

      map.current?.off("moveend", handleMapMove);
      map.current?.off("zoomend", handleZoom);
      map.current?.off("pitchend", handlePitch);
      map.current?.remove();
    };
  }, []);

  // スタイルモード変更時の処理
  useEffect(() => {
    const m = map.current;
    if (!m || currentMode.current === styleMode) return;

    // スタイル変更前にリスナーをクリーンアップ
    cleanupPathsListeners();
    cleanupMountainsListeners();
    cleanupBearsListeners();

    m.setStyle(styleUrls[styleMode]);
    m.once("styledata", () => {
      pathsListenersRegistered.current = false;
      mountainsListenersRegistered.current = false;
      bearsListenersRegistered.current = false;
      addDemAndTerrain();
      addOrUpdatePaths();
      addOrUpdateMountains();
      addOrUpdateBears();
    });
    currentMode.current = styleMode;
  }, [
    styleMode,
    styleUrls,
    addDemAndTerrain,
    addOrUpdatePaths,
    addOrUpdateMountains,
    addOrUpdateBears,
    cleanupPathsListeners,
    cleanupMountainsListeners,
    cleanupBearsListeners,
  ]);

  // パスデータ変更時の処理（ハッシュベースで変更検知）
  useEffect(() => {
    if (!map.current || !isMountedRef.current) return;

    const zoomLevel = map.current.getZoom();

    if (zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
      const isFirstLoad = previousPathsHash.current === "";
      const hasChanged = pathsHash !== previousPathsHash.current;

      if (pathsHash !== "empty" && (isFirstLoad || hasChanged)) {
        console.log("[MapTerrain] Paths data changed, updating...", {
          pathCount: paths.length,
          isFirstLoad,
          previousHash: previousPathsHash.current.substring(0, 50) || "(empty)",
          currentHash: pathsHash.substring(0, 50),
        });

        // 次のフレームで更新を実行
        const frameId = requestAnimationFrame(() => {
          animationFrameIdsRef.current.delete(frameId);
          if (
            isMountedRef.current &&
            map.current &&
            map.current.getZoom() >= ZOOM_LEVEL_THRESHOLD
          ) {
            try {
              addOrUpdatePaths();
              // 成功時のみハッシュを更新
              previousPathsHash.current = pathsHash;
            } catch (error) {
              console.error("[MapTerrain] Error updating paths:", error);
            }
          }
        });
        animationFrameIdsRef.current.add(frameId);
      }
    }
  }, [pathsHash, paths.length, addOrUpdatePaths]);

  // 山データ変更時の処理（ハッシュベースで変更検知）
  useEffect(() => {
    if (!map.current || !isMountedRef.current) return;

    const zoomLevel = map.current.getZoom();

    if (zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
      const isFirstLoad = previousMountainsHash.current === "";
      const hasChanged = mountainsHash !== previousMountainsHash.current;

      if (mountainsHash !== "empty" && (isFirstLoad || hasChanged)) {
        console.log("[MapTerrain] Mountains data changed, updating...", {
          mountainCount: mountains.length,
          isFirstLoad,
          previousHash:
            previousMountainsHash.current.substring(0, 50) || "(empty)",
          currentHash: mountainsHash.substring(0, 50),
        });

        // 次のフレームで更新を実行
        const frameId = requestAnimationFrame(() => {
          animationFrameIdsRef.current.delete(frameId);
          if (
            isMountedRef.current &&
            map.current &&
            map.current.getZoom() >= ZOOM_LEVEL_THRESHOLD
          ) {
            try {
              addOrUpdateMountains();
              // 成功時のみハッシュを更新
              previousMountainsHash.current = mountainsHash;
            } catch (error) {
              console.error("[MapTerrain] Error updating mountains:", error);
            }
          }
        });
        animationFrameIdsRef.current.add(frameId);
      }
    }
  }, [mountainsHash, mountains.length, addOrUpdateMountains]);

  // クマデータ変更時の処理（初期化時のみ実行）
  useEffect(() => {
    if (!map.current || !isMountedRef.current) return;
    if (bears.length === 0) return;

    console.log("[MapTerrain] Bears data loaded, adding layers...", {
      bearCount: bears.length,
    });

    const frameId = requestAnimationFrame(() => {
      animationFrameIdsRef.current.delete(frameId);
      if (isMountedRef.current && map.current) {
        try {
          addOrUpdateBears();
        } catch (error) {
          console.error("[MapTerrain] Error adding bears:", error);
        }
      }
    });
    animationFrameIdsRef.current.add(frameId);
  }, [bears.length, addOrUpdateBears]);

  // 指定された山にカメラを移動
  const jumpToMountain = useCallback((mountain: Mountain) => {
    const m = map.current;
    if (!m) return;

    if (mountain.lon !== undefined && mountain.lat !== undefined) {
      const elevation = mountain.elevation || 0;

      // 標高に応じたカメラパラメータを決定
      let zoom: number;
      if (elevation >= 3000) {
        zoom = 13;
      } else if (elevation >= 2000) {
        zoom = 14;
      } else {
        zoom = 15;
      }

      const pitch =
        elevation >= 3000
          ? 60
          : elevation >= 2000
            ? 45
            : elevation >= 1000
              ? 30
              : 15;
      const bearing =
        elevation >= 3000
          ? 45
          : elevation >= 2000
            ? 30
            : elevation >= 1000
              ? 15
              : 0;

      const duration =
        elevation >= 3000 ? 3500 : elevation >= 2000 ? 3000 : 2500;

      const mountainLng = Number(mountain.lon);
      const mountainLat = Number(mountain.lat);

      // 山の周辺の小さなバウンディングボックスを作成
      // これにより山が確実に画面内に表示される
      const offset = 0.02; // 約500m程度のオフセット
      const bounds: maplibregl.LngLatBoundsLike = [
        [mountainLng - offset, mountainLat - offset], // 南西
        [mountainLng + offset, mountainLat + offset], // 北東
      ];

      // fitBoundsで山の位置にフィット
      m.fitBounds(bounds, {
        padding: {
          top: 100,
          bottom: 100,
          left: 100,
          right: 100,
        },
        pitch: pitch,
        bearing: bearing,
        duration: duration,
        maxZoom: zoom,
        essential: true,
      });
    }
  }, []);

  // 選択された山が変更されたらカメラを移動
  useEffect(() => {
    if (selectedMountain) {
      // 選択された山のIDを更新
      selectedMountainIdRef.current = selectedMountain.id;

      // マップが存在し、レイヤーが存在する場合はフィルターを更新
      const m = map.current;
      if (m?.getLayer("mountains-points-selected")) {
        m.setFilter("mountains-points-selected", [
          "==",
          ["get", "id"],
          selectedMountain.id,
        ]);
        m.setFilter("mountains-points", [
          "!=",
          ["get", "id"],
          selectedMountain.id,
        ]);
      }

      jumpToMountain(selectedMountain);
    } else {
      // 選択解除時
      selectedMountainIdRef.current = null;
      const m = map.current;
      if (m?.getLayer("mountains-points-selected")) {
        m.setFilter("mountains-points-selected", ["==", ["get", "id"], -1]);
        m.setFilter("mountains-points", ["!=", ["get", "id"], -1]);
      }
    }
  }, [selectedMountain, jumpToMountain]);

  // 選択されたクマが変更されたら表示を更新
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (selectedBear) {
      // 選択されたクマのIDを更新
      selectedBearIdRef.current = selectedBear.id;

      // マップが存在し、レイヤーが存在する場合はフィルターを更新
      if (m.getLayer("bears-points-selected")) {
        m.setFilter("bears-points-selected", [
          "==",
          ["get", "id"],
          selectedBear.id,
        ]);
        m.setFilter("bears-points", ["!=", ["get", "id"], selectedBear.id]);
      }
    } else {
      // 選択解除時
      selectedBearIdRef.current = null;
      if (m.getLayer("bears-points-selected")) {
        m.setFilter("bears-points-selected", ["==", ["get", "id"], -1]);
        m.setFilter("bears-points", ["!=", ["get", "id"], -1]);
      }
    }
  }, [selectedBear]);

  // ホバーポイントのマーカー表示
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    // 既存のマーカーを削除
    if (hoveredPointMarker.current) {
      hoveredPointMarker.current.remove();
      hoveredPointMarker.current = null;
    }

    // ホバーポイントが指定されている場合はマーカーを表示
    if (hoveredPoint) {
      const el = document.createElement("div");
      el.className = "hovered-point-marker";
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#ff4444";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";

      hoveredPointMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([hoveredPoint.lon, hoveredPoint.lat])
        .addTo(m);
    }
  }, [hoveredPoint]);

  // 2D/3Dビューの切り替え
  const toggle2D3D = useCallback(() => {
    const m = map.current;
    if (!m) return;

    const currentPitch = m.getPitch();
    if (currentPitch > 0) {
      m.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
    } else {
      m.easeTo({
        pitch: 60,
        bearing: 30,
        duration: 1000,
      });
    }
  }, []);

  // 北方向にリセット
  const resetNorth = useCallback(() => {
    const m = map.current;
    if (!m) return;

    m.easeTo({ bearing: 0, duration: 1000 });
  }, []);

  // 現在地へ移動
  const goToCurrentLocation = useCallback(() => {
    if (geolocateControl.current) {
      geolocateControl.current.trigger();
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {/* カスタムポップアップのスタイル */}
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
      {/* マップ操作ボタン */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={goToCurrentLocation}
          className="cursor-pointer flex items-center justify-center w-9 h-9 bg-white border border-gray-300 rounded shadow hover:bg-gray-100 transition-colors"
          title="現在地へ移動"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className="w-5 h-5"
            fill="currentColor"
          >
            <title>Go to Current Location</title>
            <path d="M256 0c17.7 0 32 14.3 32 32V66.7C368.4 80.1 431.9 143.6 445.3 224H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H445.3C431.9 368.4 368.4 431.9 288 445.3V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V445.3C143.6 431.9 80.1 368.4 66.7 288H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H66.7C80.1 143.6 143.6 80.1 224 66.7V32c0-17.7 14.3-32 32-32zM128 256a128 128 0 1 0 256 0 128 128 0 1 0 -256 0zm128-80a80 80 0 1 1 0 160 80 80 0 1 1 0-160z" />
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
    </div>
  );
};
