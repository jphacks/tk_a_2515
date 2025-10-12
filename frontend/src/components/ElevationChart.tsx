import { useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Point } from "@/app/api/lib/models/point";

type Props = {
  data: Point[];
  onHoverPointChange?: (point: { lat: number; lon: number } | null) => void;
};

export default function ElevationChart({ data, onHoverPointChange }: Props) {
  const lastHoveredPoint = useRef<{ lat: number; lon: number } | null>(null);
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 bg-slate-100 rounded-lg flex items-center justify-center">
        <p className="text-slate-400">標高データがありません</p>
      </div>
    );
  }

  // データの最大値と最小値を計算
  const minElevation = Math.min(...data.map(d => d.y));
  const maxElevation = Math.max(...data.map(d => d.y));
  const elevationRange = maxElevation - minElevation;

  // Y軸の範囲を設定（余白を追加）
  const yAxisMin = Math.floor(minElevation - elevationRange * 0.1);
  const yAxisMax = Math.ceil(maxElevation + elevationRange * 0.1);

  // 最大距離を取得
  const maxDistance = data[data.length - 1]?.x || 0;

  // チャートからマウスが離れたときにホバーをクリア
  const handleMouseLeave = () => {
    if (lastHoveredPoint.current !== null) {
      lastHoveredPoint.current = null;
      if (onHoverPointChange) {
        onHoverPointChange(null);
      }
    }
  };

  // カスタムツールチップ
  // biome-ignore lint/correctness/noNestedComponentDefinitions: <explanation>
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const distance = point.x;
      const elevation = point.y;
      const lon = point.lon;
      const lat = point.lat;

      // コンソールに緯度経度を出力
      console.log(
        `Selected point - Latitude: ${lat}, Longitude: ${lon}, Elevation: ${elevation}m, Distance: ${(distance / 1000).toFixed(2)}km`,
      );

      // 前回と異なる地点の場合のみ親コンポーネントに通知
      if (
        onHoverPointChange &&
        (!lastHoveredPoint.current ||
          lastHoveredPoint.current.lat !== lat ||
          lastHoveredPoint.current.lon !== lon)
      ) {
        lastHoveredPoint.current = { lat, lon };
        onHoverPointChange({ lat, lon });
      }

      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm font-semibold text-slate-700">
            距離: {(distance / 1000).toFixed(2)} km
          </p>
          <p className="text-sm font-semibold text-green-700">
            標高: {elevation.toFixed(0)} m
          </p>
          <p className="text-xs text-slate-500 mt-1">
            緯度: {lat.toFixed(6)}, 経度: {lon.toFixed(6)}
          </p>
        </div>
      );
    }

    return null;
  };

  // X軸のフォーマット（メートルをキロメートルに変換）
  const formatXAxis = (value: number) => {
    return `${(value / 1000).toFixed(1)}km`;
  };

  // Y軸のフォーマット
  const formatYAxis = (value: number) => {
    return `${value}m`;
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm text-slate-600 ml-auto">
          <span className="font-medium">総距離:</span>{" "}
          {(maxDistance / 1000).toFixed(2)} km
        </div>
      </div>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: <explanation> */}
      <div
        className="bg-white rounded-lg border border-slate-200 p-4"
        onMouseLeave={handleMouseLeave}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              {/** biome-ignore lint/correctness/useUniqueElementIds: <explanation> */}
              <linearGradient
                id="elevationGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="x"
              tickFormatter={formatXAxis}
              stroke="#64748b"
              style={{ fontSize: "12px" }}
            />
            <YAxis
              domain={[yAxisMin, yAxisMax]}
              tickFormatter={formatYAxis}
              stroke="#64748b"
              style={{ fontSize: "12px" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="y"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#elevationGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
