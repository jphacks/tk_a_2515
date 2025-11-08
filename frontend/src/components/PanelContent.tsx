import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react"; // ✨ 1. 必要なフックをインポート
import type { Mountain, Path, PathDetail } from "@/app/api/lib/models"; // Path を追加
import ElevationChart from "./ElevationChart";

type Props = {
  mountains: Mountain[];
  selectedMountain: Mountain | null;
  selectedPath?: PathDetail | null; // 追加
  onSelectMountain: (mountain: Mountain) => void;
  onSelectPath?: (path: Path) => void; // 追加
  onClearSelection: () => void;
  onHoverPointChange?: (point: { lat: number; lon: number } | null) => void;
};

export default function PanelContent({
  mountains,
  selectedMountain,
  selectedPath, // 追加
  onSelectMountain,
  onClearSelection,
  onHoverPointChange,
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
    // 詳細表示
    return (
      <div className="p-5">
        <button
          type="button"
          onClick={onClearSelection}
          className="cursor-pointer flex items-center gap-2 mb-4 text-sm text-green-700 font-semibold hover:text-green-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          山の一覧に戻る
        </button>
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
      {mountains.length > 0 ? ( // ✨ mountains が存在する場合のみリストを表示
        <ul className="divide-y divide-slate-100">
          {mountains.map(mountain => (
            <li key={mountain.id} className="p-0">
              <button
                type="button"
                onClick={() => handleSelectAndSaveScroll(mountain)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleSelectAndSaveScroll(mountain);
                  }
                }}
                className="w-full text-left p-5 hover:bg-green-50 cursor-pointer transition-colors flex items-center gap-4"
              >
                {mountain.photo_url ? (
                  <Image
                    src={mountain.photo_url}
                    alt={mountain.name}
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                    width={64}
                    height={64}
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                    画像なし
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-700">{mountain.name}</h3>
                  {mountain.elevation && !Number.isNaN(mountain.elevation) && (
                    <p className="text-sm text-slate-500">
                      標高: {mountain.elevation.toLocaleString()} m
                    </p>
                  )}
                  {mountain.prefectures && mountain.prefectures.length > 0 && (
                    <p className="text-sm text-slate-500">
                      都道府県:{" "}
                      {mountain.prefectures.map(p => p.name).join(", ")}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5 text-center text-slate-500"></div>
      )}
    </div>
  );
}
