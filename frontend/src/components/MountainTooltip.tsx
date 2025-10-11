interface MountainTooltipProps {
  name: string;
  elevation: number;
}

export const MountainTooltip = ({ name, elevation }: MountainTooltipProps) => {
  // ✨ 標高に基づく色の決定
  const getElevationColor = (elevation: number) => {
    if (elevation >= 3000) return "from-purple-500 to-indigo-600";
    if (elevation >= 2000) return "from-pink-500 to-purple-600";
    if (elevation >= 1000) return "from-orange-500 to-pink-600";
    return "from-red-500 to-orange-600";
  };

  // ✨ 標高に基づくアイコンの決定
  const getElevationIcon = (elevation: number) => {
    if (elevation >= 3000) return "🏔️";
    if (elevation >= 2000) return "⛰️";
    if (elevation >= 1000) return "🗻";
    return "🏕️";
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-2xl border border-gray-100 p-4 min-w-[250px] max-w-[300px]">
      {/* ✨ ヘッダー部分 */}
      <div
        className={`bg-gradient-to-r ${getElevationColor(elevation)} rounded-lg p-3 mb-3 text-white`}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">{getElevationIcon(elevation)}</div>
          <div>
            <h3 className="font-bold text-lg leading-tight">{name}</h3>
          </div>
        </div>
      </div>

      {/* ✨ 詳細情報 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 text-sm font-medium">標高</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-800">
              {elevation.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 font-medium">m</span>
          </div>
        </div>

        {/* ✨ 標高ランク表示 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getElevationColor(elevation)} transition-all duration-500`}
              style={{ width: `${Math.min((elevation / 4000) * 100, 100)}%` }}
            ></div>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {elevation >= 3000
              ? "高山"
              : elevation >= 2000
                ? "中山"
                : elevation >= 1000
                  ? "低山"
                  : "丘陵"}
          </span>
        </div>

        {/* ✨ 追加情報 */}
        <button
          type="button"
          data-detail-button
          className="w-full text-xs text-gray-400 text-center pt-2 border-t border-gray-100 hover:text-blue-600 hover:bg-blue-50 rounded-b-lg transition-colors cursor-pointer"
        >
          クリックして詳細を表示
        </button>
      </div>
    </div>
  );
};
