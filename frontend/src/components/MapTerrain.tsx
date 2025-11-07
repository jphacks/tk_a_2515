"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { renderToString } from "react-dom/server";
import type { Mountain, Path, PathDetail } from "@/app/api/lib/models";
import { MountainTooltip } from "./MountainTooltip";

// 山とパスを表示するズームレベルの閾値
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

  // 参照の保持
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const currentMode = useRef<StyleMode>(styleMode);
  const hoveredPointMarker = useRef<maplibregl.Marker | null>(null);
  const pathsListenersRegistered = useRef<boolean>(false);
  const mountainsListenersRegistered = useRef<boolean>(false);
  const pathsRef = useRef<Path[]>(paths);
  const mountainsRef = useRef<Mountain[]>(mountains);
  const previousPathsHash = useRef<string>("");
  const previousMountainsHash = useRef<string>("");

  // イベントハンドラーの参照を保持してクリーンアップ可能にする
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

  // データのハッシュを生成して変更検知に使用
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

  // 最新のデータへの参照を常に保持
  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  useEffect(() => {
    mountainsRef.current = mountains;
  }, [mountains]);

  // 地形タイルとDEMを追加
  const addDemAndTerrain = useCallback(() => {
    const m = map.current;
    if (!m) return;
    if (!m.getSource("maptiler-dem")) {
      m.addSource("maptiler-dem", { type: "raster-dem", url: demTilesJsonUrl });
    }
    m.setTerrain({ source: "maptiler-dem", exaggeration: 1.5 });
  }, [demTilesJsonUrl]);

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
    if (!m) return;

    // ズームレベルが閾値未満の場合はレイヤーを削除
    if (m.getZoom() < ZOOM_LEVEL_THRESHOLD) {
      // イベントリスナーをクリーンアップ
      if (pathsListenersRegistered.current) {
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
      }

      if (m.getLayer("paths-layer-hitbox")) m.removeLayer("paths-layer-hitbox");
      if (m.getLayer("paths-layer")) m.removeLayer("paths-layer");
      if (m.getSource("paths-source")) m.removeSource("paths-source");
      pathsListenersRegistered.current = false;
      return;
    }

    const source = m.getSource("paths-source") as maplibregl.GeoJSONSource;

    // ソースが既に存在する場合はデータのみ更新
    if (source) {
      source.setData(pathsGeoJSON);
      return;
    }

    // ソースとレイヤーを新規追加
    m.addSource("paths-source", {
      type: "geojson",
      data: pathsGeoJSON,
    });

    // 視覚的なパスレイヤー
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

    // イベントリスナーを一度だけ登録
    if (!pathsListenersRegistered.current && onSelectPath) {
      const handleClick = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        if (onSelectPath) {
          onSelectPath(feature.properties as Path);
        }
      };

      const handleMouseEnter = () => {
        m.getCanvas().style.cursor = "pointer";
      };

      const handleMouseLeave = () => {
        m.getCanvas().style.cursor = "";
      };

      // ハンドラーの参照を保存
      pathsEventHandlers.current = {
        handleClick,
        handleMouseEnter,
        handleMouseLeave,
      };

      m.on("click", "paths-layer-hitbox", handleClick);
      m.on("mouseenter", "paths-layer-hitbox", handleMouseEnter);
      m.on("mouseleave", "paths-layer-hitbox", handleMouseLeave);

      pathsListenersRegistered.current = true;
    }
  }, [pathsGeoJSON, onSelectPath]);

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
    if (!m) return;

    // ズームレベルが閾値未満の場合はレイヤーを削除
    if (m.getZoom() < ZOOM_LEVEL_THRESHOLD) {
      // イベントリスナーをクリーンアップ
      if (mountainsListenersRegistered.current) {
        if (mountainsEventHandlers.current.handleClick) {
          m.off(
            "click",
            "mountains-points",
            mountainsEventHandlers.current.handleClick,
          );
        }
        if (mountainsEventHandlers.current.handleMouseEnter) {
          m.off(
            "mouseenter",
            "mountains-points",
            mountainsEventHandlers.current.handleMouseEnter,
          );
        }
        if (mountainsEventHandlers.current.handleMouseLeave) {
          m.off(
            "mouseleave",
            "mountains-points",
            mountainsEventHandlers.current.handleMouseLeave,
          );
        }
        mountainsEventHandlers.current = {};
      }

      if (m.getLayer("mountains-labels")) m.removeLayer("mountains-labels");
      if (m.getLayer("mountains-points-hover"))
        m.removeLayer("mountains-points-hover");
      if (m.getLayer("mountains-points")) m.removeLayer("mountains-points");
      if (m.getLayer("mountains-points-shadow"))
        m.removeLayer("mountains-points-shadow");
      if (m.getSource("mountains-source")) m.removeSource("mountains-source");
      mountainsListenersRegistered.current = false;
      return;
    }

    const source = m.getSource("mountains-source") as maplibregl.GeoJSONSource;

    // ソースが既に存在する場合はデータのみ更新
    if (source) {
      source.setData(mountainsGeoJSON);
      return;
    }

    // スタイルがロードされていない場合は次のフレームで再試行
    if (!m.isStyleLoaded()) {
      requestAnimationFrame(() => {
        addOrUpdateMountains();
      });
      return;
    }

    // レイヤー追加時のエラーハンドリング
    try {
      // ソースを追加
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
      });

      // ホバー時に表示する拡大されたレイヤー
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
        filter: ["==", ["get", "id"], ""], // 初期状態では非表示
      });

      // ラベルレイヤー
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
    } catch (error) {
      console.error("[MapTerrain] Error adding mountains layers:", error);
      // エラー時は次のフレームで再試行
      requestAnimationFrame(() => {
        addOrUpdateMountains();
      });
      return;
    }

    // イベントリスナーを一度だけ登録
    if (!mountainsListenersRegistered.current) {
      // クリック時にポップアップを表示
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

      // マウスホバー時にホバーレイヤーを表示
      const handleMouseEnter = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        m.getCanvas().style.cursor = "pointer";
        if (e.features?.[0]) {
          const featureId = e.features[0].properties?.id;
          // フィルターを更新してホバーレイヤーを表示
          m.setFilter("mountains-points-hover", [
            "==",
            ["get", "id"],
            featureId,
          ]);
        }
      };

      // マウスが離れたらホバーレイヤーを非表示
      const handleMouseLeave = () => {
        m.getCanvas().style.cursor = "";
        m.setFilter("mountains-points-hover", ["==", ["get", "id"], ""]);
      };

      // ハンドラーの参照を保存
      mountainsEventHandlers.current = {
        handleClick,
        handleMouseEnter,
        handleMouseLeave,
      };

      m.on("click", "mountains-points", handleClick);
      m.on("mouseenter", "mountains-points", handleMouseEnter);
      m.on("mouseleave", "mountains-points", handleMouseLeave);

      mountainsListenersRegistered.current = true;
    }
  }, [mountainsGeoJSON, onSelectMountain]);

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
        // ズームレベルが閾値未満の場合、イベントリスナーとレイヤーをクリーンアップ
        if (pathsListenersRegistered.current) {
          if (pathsEventHandlers.current.handleClick) {
            map.current.off(
              "click",
              "paths-layer-hitbox",
              pathsEventHandlers.current.handleClick,
            );
          }
          if (pathsEventHandlers.current.handleMouseEnter) {
            map.current.off(
              "mouseenter",
              "paths-layer-hitbox",
              pathsEventHandlers.current.handleMouseEnter,
            );
          }
          if (pathsEventHandlers.current.handleMouseLeave) {
            map.current.off(
              "mouseleave",
              "paths-layer-hitbox",
              pathsEventHandlers.current.handleMouseLeave,
            );
          }
          pathsEventHandlers.current = {};
        }

        if (mountainsListenersRegistered.current) {
          if (mountainsEventHandlers.current.handleClick) {
            map.current.off(
              "click",
              "mountains-points",
              mountainsEventHandlers.current.handleClick,
            );
          }
          if (mountainsEventHandlers.current.handleMouseEnter) {
            map.current.off(
              "mouseenter",
              "mountains-points",
              mountainsEventHandlers.current.handleMouseEnter,
            );
          }
          if (mountainsEventHandlers.current.handleMouseLeave) {
            map.current.off(
              "mouseleave",
              "mountains-points",
              mountainsEventHandlers.current.handleMouseLeave,
            );
          }
          mountainsEventHandlers.current = {};
        }

        // レイヤーを削除（ホバーレイヤーも含む）
        if (map.current.getLayer("mountains-labels"))
          map.current.removeLayer("mountains-labels");
        if (map.current.getLayer("mountains-points-hover"))
          map.current.removeLayer("mountains-points-hover");
        if (map.current.getLayer("mountains-points"))
          map.current.removeLayer("mountains-points");
        if (map.current.getLayer("mountains-points-shadow"))
          map.current.removeLayer("mountains-points-shadow");
        if (map.current.getSource("mountains-source"))
          map.current.removeSource("mountains-source");
        if (map.current.getLayer("paths-layer-hitbox"))
          map.current.removeLayer("paths-layer-hitbox");
        if (map.current.getLayer("paths-layer"))
          map.current.removeLayer("paths-layer");
        if (map.current.getSource("paths-source"))
          map.current.removeSource("paths-source");

        mountainsListenersRegistered.current = false;
        pathsListenersRegistered.current = false;
      } else {
        // ズームレベルが閾値以上の場合、レイヤーを更新
        addOrUpdatePaths();
        addOrUpdateMountains();
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
    };

    // ピッチ変更時の処理
    const handlePitch = () => {
      if (!map.current) return;
      const zoomLevel = map.current.getZoom();

      if (zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
        addOrUpdatePaths();
        addOrUpdateMountains();
      }
    };

    map.current.on("load", () => {
      addDemAndTerrain();
      addOrUpdatePaths();
      addOrUpdateMountains();

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
      const m = map.current;
      if (m) {
        // イベントリスナーを削除
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

        if (mountainsEventHandlers.current.handleClick) {
          m.off(
            "click",
            "mountains-points",
            mountainsEventHandlers.current.handleClick,
          );
        }
        if (mountainsEventHandlers.current.handleMouseEnter) {
          m.off(
            "mouseenter",
            "mountains-points",
            mountainsEventHandlers.current.handleMouseEnter,
          );
        }
        if (mountainsEventHandlers.current.handleMouseLeave) {
          m.off(
            "mouseleave",
            "mountains-points",
            mountainsEventHandlers.current.handleMouseLeave,
          );
        }
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

    // スタイル変更前にイベントリスナーをクリーンアップ
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

    if (mountainsEventHandlers.current.handleClick) {
      m.off(
        "click",
        "mountains-points",
        mountainsEventHandlers.current.handleClick,
      );
    }
    if (mountainsEventHandlers.current.handleMouseEnter) {
      m.off(
        "mouseenter",
        "mountains-points",
        mountainsEventHandlers.current.handleMouseEnter,
      );
    }
    if (mountainsEventHandlers.current.handleMouseLeave) {
      m.off(
        "mouseleave",
        "mountains-points",
        mountainsEventHandlers.current.handleMouseLeave,
      );
    }

    pathsEventHandlers.current = {};
    mountainsEventHandlers.current = {};

    // スタイルを変更してレイヤーを再構築
    m.setStyle(styleUrls[styleMode]);
    m.once("styledata", () => {
      pathsListenersRegistered.current = false;
      mountainsListenersRegistered.current = false;
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

  // パスデータ変更時の処理（ハッシュベースで変更検知）
  useEffect(() => {
    if (!map.current) return;

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

        // ハッシュを先に更新して重複更新を防ぐ
        previousPathsHash.current = pathsHash;

        // 次のフレームで更新を実行
        requestAnimationFrame(() => {
          if (map.current && map.current.getZoom() >= ZOOM_LEVEL_THRESHOLD) {
            addOrUpdatePaths();
          }
        });
      }
    }
  }, [pathsHash, paths.length, addOrUpdatePaths]);

  // 山データ変更時の処理（ハッシュベースで変更検知）
  useEffect(() => {
    if (!map.current) return;

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

        // ハッシュを先に更新して重複更新を防ぐ
        previousMountainsHash.current = mountainsHash;

        // 次のフレームで更新を実行
        requestAnimationFrame(() => {
          if (map.current && map.current.getZoom() >= ZOOM_LEVEL_THRESHOLD) {
            addOrUpdateMountains();
          }
        });
      }
    }
  }, [mountainsHash, mountains.length, addOrUpdateMountains]);

  // 指定された山にカメラを移動
  const jumpToMountain = useCallback((mountain: Mountain) => {
    const m = map.current;
    if (!m) return;

    if (mountain.lon !== undefined && mountain.lat !== undefined) {
      const elevation = mountain.elevation || 0;

      // 標高に応じたカメラパラメータを決定
      let zoom: number;
      if (elevation >= 3000) {
        zoom = Math.min(m.getZoom(), 14);
      } else if (elevation >= 2000) {
        zoom = Math.min(m.getZoom(), 15);
      } else if (elevation >= 1000) {
        zoom = Math.min(m.getZoom(), 16);
      } else {
        zoom = Math.min(m.getZoom(), 17);
      }

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

  // 選択された山が変更されたらカメラを移動
  useEffect(() => {
    if (selectedMountain) {
      jumpToMountain(selectedMountain);
    }
  }, [selectedMountain, jumpToMountain]);

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

    m.easeTo({ bearing: 0 });
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
      {/* 凡例 */}
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
              backgroundColor: "#829DFF",
              opacity: 0.8,
            }}
          ></div>
          <span>登山道</span>
        </div>
      </div>
    </div>
  );
};
