import { ArrowLeft, Heart } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  BearSighting,
  Mountain,
  Path,
  PathDetail,
} from "@/app/api/lib/models";
import ElevationChart from "./ElevationChart";

type Props = {
  mountains: Mountain[];
  visibleMountainIds: Set<number>;
  selectedMountain: Mountain | null;
  selectedPath: PathDetail | null;
  selectedBear: BearSighting | null;
  onSelectMountain: (mountain: Mountain) => void;
  onSelectPath: (path: Path) => void;
  onSelectBear: (bear: BearSighting) => void;
  onClearSelection: () => void;
  onHoverPointChange: (point: { lat: number; lon: number } | null) => void;
  isFavorite: (mountainId: number) => boolean;
  onToggleFavorite: (mountain: Mountain) => void;
};

export default function PanelContent({
  mountains,
  visibleMountainIds,
  selectedMountain,
  selectedPath,
  selectedBear,
  onSelectMountain,
  onClearSelection,
  onHoverPointChange,
  isFavorite,
  onToggleFavorite,
}: Props) {
  // ✨ 2. スクロール位置を保持するためのstateと、リストコンテナへの参照(ref)を作成
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // ✨ 3. 山を選択したときに、現在のスクロール位置を保存するハンドラ関数
  const handleSelectAndSaveScroll = (mountain: Mountain) => {
    if (listContainerRef.current) {
      // 現在のスクロール位置(scrollTop)をstateに保存
      setScrollPosition(listContainerRef.current.scrollTop);
    }
    // 親から渡された本来の選択処理を実行
    onSelectMountain(mountain);
  };

  // ✨ 4. 詳細表示からリスト表示に戻ったときに、保存したスクロール位置を復元する副作用フック
  useEffect(() => {
    // selectedMountainがnullになった（＝リスト表示に戻った）時だけ実行
    if (!selectedMountain && listContainerRef.current) {
      // 保存しておいたscrollPositionをリストコンテナのscrollTopに設定
      listContainerRef.current.scrollTop = scrollPosition;
    }
  }, [selectedMountain, scrollPosition]); // selectedMountainが変わるたびにチェック

  // ✨ 5. mountains が変化した際にスクロール位置をリセットする副作用フック
  // biome-ignore lint/correctness/useExhaustiveDependencies: force re-render only when mountains change
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [mountains]); // mountains が変化するたびに実行

  if (selectedMountain) {
    const isFav = isFavorite?.(selectedMountain.id) ?? false;

    // 詳細表示
    return (
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onClearSelection}
            className="cursor-pointer flex items-center gap-2 text-base text-green-700 font-semibold hover:text-green-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            山の一覧に戻る
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(selectedMountain)}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg font-semibold text-base transition-colors cursor-pointer ${
              isFav
                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
            {isFav ? "お気に入り解除" : "お気に入り登録"}
          </button>
        </div>
        <div className="aspect-video bg-slate-200 rounded-lg mb-4 flex items-center justify-center">
          {selectedMountain.photo_url ? (
            <Image
              src={selectedMountain.photo_url}
              alt={selectedMountain.name}
              className="object-cover w-full h-full rounded-lg"
              width={800}
              height={600}
            />
          ) : (
            <p className="text-slate-400">画像がありません</p>
          )}
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">
          {selectedMountain.name}
        </h2>
        <table className="w-full text-sm text-left text-slate-500 mb-4">
          <tbody>
            {selectedMountain.yomi && (
              <tr>
                <th className="font-medium text-slate-700 pr-4 py-2">読み</th>
                <td className="py-2">{selectedMountain.yomi}</td>
              </tr>
            )}
            {selectedMountain.other_names && (
              <tr>
                <th className="font-medium text-slate-700 pr-4 py-2">別名</th>
                <td className="py-2">{selectedMountain.other_names}</td>
              </tr>
            )}
            {selectedMountain.elevation && (
              <tr>
                <th className="font-medium text-slate-700 pr-4 py-2">標高</th>
                <td className="py-2">
                  {selectedMountain.elevation.toLocaleString()} m
                </td>
              </tr>
            )}
            {selectedMountain.lat && selectedMountain.lon && (
              <tr>
                <th className="font-medium text-slate-700 pr-4 py-2">座標</th>
                <td className="py-2">
                  緯度: {selectedMountain.lat.toFixed(6)}, 経度:{" "}
                  {selectedMountain.lon.toFixed(6)}
                </td>
              </tr>
            )}
            {selectedMountain.prefectures &&
              selectedMountain.prefectures.length > 0 && (
                <tr>
                  <th className="font-medium text-slate-700 pr-4 py-2">
                    都道府県
                  </th>
                  <td className="py-2">
                    {selectedMountain.prefectures.map(p => p.name).join(", ")}
                  </td>
                </tr>
              )}
            {selectedMountain.types && (
              <tr>
                <th className="font-medium text-slate-700 pr-4 py-2">タイプ</th>
                <td className="py-2">
                  {selectedMountain.types.map(t => t.name).join(", ")}
                </td>
              </tr>
            )}
            {selectedMountain.detail && (
              <tr>
                <th className="font-medium text-slate-700 pr-4 py-2">詳細</th>
                <td className="py-2">{selectedMountain.detail}</td>
              </tr>
            )}
          </tbody>
        </table>
        {selectedMountain.lat && selectedMountain.lon && (
          <a
            href={`https://www.google.com/maps?q=${selectedMountain.lat},${selectedMountain.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 font-semibold hover:text-green-800 transition-colors mb-4 flex items-center gap-1"
          >
            Google Map で表示
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <title>Google Map で表示</title>
              <path d="M14 3H21V10H19V6.41L10.41 15L9 13.59L17.59 5H14V3ZM5 5H11V7H5V19H17V13H19V19C19 20.1 18.1 21 17 21H5C3.9 21 3 20.1 3 19V7C3 5.9 3.9 5 5 5Z" />
            </svg>
          </a>
        )}
        {selectedMountain.page_url && (
          <a
            href={selectedMountain.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 font-semibold hover:text-green-800 transition-colors flex items-center gap-1"
          >
            詳細ページを見る
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <title>詳細ページを見る</title>
              <path d="M14 3H21V10H19V6.41L10.41 15L9 13.59L17.59 5H14V3ZM5 5H11V7H5V19H17V13H19V19C19 20.1 18.1 21 17 21H5C3.9 21 3 20.1 3 19V7C3 5.9 3.9 5 5 5Z" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  if (selectedPath) {
    return (
      <div className="p-5 h-full overflow-y-auto">
        <button
          type="button"
          onClick={onClearSelection}
          className="cursor-pointer flex items-center gap-2 mb-4 text-sm text-green-700 font-semibold hover:text-green-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          山の一覧に戻る
        </button>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">経路情報</h2>

        {/* 標高グラフ */}
        {selectedPath.path_graphic && selectedPath.path_graphic.length > 0 && (
          <div className="mb-6">
            <ElevationChart
              data={selectedPath.path_graphic}
              onHoverPointChange={onHoverPointChange}
            />
          </div>
        )}

        {/* 経路情報 */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">
            経路情報
          </h3>
          <p className="text-sm text-slate-600">
            <span className="font-medium">ID:</span> {selectedPath.id}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">OSM ID:</span> {selectedPath.osm_id}
          </p>
          {selectedPath.difficulty !== null &&
            selectedPath.difficulty !== undefined && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">難易度:</span>{" "}
                {selectedPath.difficulty}
              </p>
            )}
          <p className="text-sm text-slate-600">
            <span className="font-medium">データポイント数:</span>{" "}
            {selectedPath.path_graphic?.length || 0}
          </p>
          {selectedPath.geometries && selectedPath.geometries.length > 0 && (
            <>
              <p className="text-sm text-slate-600">
                <span className="font-medium">始点 Geometry ID:</span>{" "}
                {selectedPath.geometries[0].id}
              </p>
              {selectedPath.geometries.length > 1 && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium">終点 Geometry ID:</span>{" "}
                  {
                    selectedPath.geometries[selectedPath.geometries.length - 1]
                      .id
                  }
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (selectedBear) {
    return (
      <div className="p-5 h-full overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            onClearSelection();
          }}
          className="cursor-pointer flex items-center gap-2 mb-4 text-sm text-green-700 font-semibold hover:text-green-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          山の一覧に戻る
        </button>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">クマ目撃情報</h2>

        {selectedBear.image_url && (
          <div className="aspect-video bg-slate-200 rounded-lg mb-4 flex items-center justify-center">
            <Image
              src={selectedBear.image_url}
              alt="クマ目撃情報"
              className="object-cover w-full h-full rounded-lg"
              width={800}
              height={600}
            />
          </div>
        )}

        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 mb-4">
          <p className="text-amber-800 font-medium">⚠️ 注意が必要なエリアです</p>
        </div>

        <table className="w-full text-sm text-left text-slate-500 mb-4">
          <tbody>
            <tr>
              <th className="font-medium text-slate-700 pr-4 py-2">都道府県</th>
              <td className="py-2">{selectedBear.prefecture}</td>
            </tr>
            <tr>
              <th className="font-medium text-slate-700 pr-4 py-2">市区町村</th>
              <td className="py-2">{selectedBear.city}</td>
            </tr>
            <tr>
              <th className="font-medium text-slate-700 pr-4 py-2">座標</th>
              <td className="py-2">
                緯度: {selectedBear.latitude.toFixed(6)}, 経度:{" "}
                {selectedBear.longitude.toFixed(6)}
              </td>
            </tr>
            {selectedBear.reported_at && (
              <tr>
                <th className="font-medium text-slate-700 pr-4 py-2">
                  報告日時
                </th>
                <td className="py-2">
                  {new Date(selectedBear.reported_at).toLocaleString("ja-JP")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {selectedBear.summary && (
          <div className="mb-4">
            <h3 className="font-semibold text-slate-700 mb-2">概要</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              {selectedBear.summary}
            </p>
          </div>
        )}

        {selectedBear.source_url && (
          <a
            href={selectedBear.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 font-semibold hover:text-green-800 transition-colors flex items-center gap-1"
          >
            詳細情報を見る
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <title>詳細情報を見る</title>
              <path d="M14 3H21V10H19V6.41L10.41 15L9 13.59L17.59 5H14V3ZM5 5H11V7H5V19H17V13H19V19C19 20.1 18.1 21 17 21H5C3.9 21 3 20.1 3 19V7C3 5.9 3.9 5 5 5Z" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  // リスト表示
  return (
    <div ref={listContainerRef} className="h-full overflow-y-auto">
      {/* ヘッダー部分はスクロールしても追従するように sticky を指定 */}
      <div className="p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
        <h2 className="text-xl font-bold text-slate-800">
          {mountains.length > 0
            ? `${mountains.length} 件の山`
            : "山がある場所でズームしてください"}
        </h2>
      </div>
      {mountains.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {mountains.map(mountain => {
            const isVisible = visibleMountainIds?.has(mountain.id) ?? true;
            return (
              <li key={mountain.id} className="p-0">
                <button
                  type="button"
                  onClick={() => handleSelectAndSaveScroll(mountain)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSelectAndSaveScroll(mountain);
                    }
                  }}
                  className={`w-full text-left p-5 cursor-pointer transition-colors flex items-center gap-4 ${
                    isVisible
                      ? "hover:bg-green-50"
                      : "bg-slate-100 hover:bg-slate-200"
                  }`}
                >
                  {mountain.photo_url ? (
                    <Image
                      src={mountain.photo_url}
                      alt={mountain.name}
                      className={`w-16 h-16 object-cover rounded-lg border ${
                        isVisible
                          ? "border-slate-200"
                          : "border-slate-300 opacity-70"
                      }`}
                      width={64}
                      height={64}
                    />
                  ) : (
                    <div
                      className={`w-16 h-16 rounded-lg flex items-center justify-center text-slate-400 text-sm ${
                        isVisible ? "bg-slate-100" : "bg-slate-200 opacity-70"
                      }`}
                    >
                      画像なし
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`font-bold ${
                          isVisible ? "text-slate-700" : "text-slate-500"
                        }`}
                      >
                        {mountain.name}
                      </h3>
                      {!isVisible && (
                        <span className="text-xs px-2 py-0.5 bg-slate-300 text-slate-600 rounded-full">
                          画面外
                        </span>
                      )}
                    </div>
                    {mountain.elevation && !Number.isNaN(mountain.elevation) && (
                      <p
                        className={`text-sm ${
                          isVisible ? "text-slate-500" : "text-slate-400"
                        }`}
                      >
                        標高: {mountain.elevation.toLocaleString()} m
                      </p>
                    )}
                    {mountain.prefectures &&
                      mountain.prefectures.length > 0 && (
                        <p
                          className={`text-sm ${
                            isVisible ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          都道府県:{" "}
                          {mountain.prefectures.map(p => p.name).join(", ")}
                        </p>
                      )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-5 text-center text-slate-500"></div>
      )}
    </div>
  );
}
