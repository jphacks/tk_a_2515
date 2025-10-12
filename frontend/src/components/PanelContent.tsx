import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react"; // ✨ 1. 必要なフックをインポート
import type { Mountain, Path } from "@/app/api/lib/models"; // Path を追加

type Props = {
  mountains: Mountain[];
  selectedMountain: Mountain | null;
  selectedPath?: Path | null; // 追加
  onSelectMountain: (mountain: Mountain) => void;
  onSelectPath?: (path: Path) => void; // 追加
  onClearSelection: () => void;
};

export default function PanelContent({
  mountains,
  selectedMountain,
  selectedPath, // 追加
  onSelectMountain,
  onClearSelection,
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
    // 詳細表示 (このブロックは変更ありません)
    return (
      <div className="p-5">
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-2 mb-4 text-sm text-green-700 font-semibold hover:text-green-800 transition-colors"
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
              width={800} // Adjust width as needed
              height={600} // Adjust height as needed
            />
          ) : (
            <p className="text-slate-400">山の画像</p>
          )}
        </div>
        <h2 className="text-3xl font-bold text-slate-800">
          {selectedMountain.name}
        </h2>
        {selectedMountain.yomi && (
          <p className="text-md text-slate-500 mb-2 font-medium">
            読み: {selectedMountain.yomi}
          </p>
        )}
        {selectedMountain.elevation && (
          <p className="text-md text-slate-500 mb-4 font-medium">
            標高: {selectedMountain.elevation.toLocaleString()}m
          </p>
        )}
        {selectedMountain.prefectures && (
          <p className="text-md text-slate-500 mb-4 font-medium">
            都道府県: {selectedMountain.prefectures.map(p => p.name).join(", ")}
          </p>
        )}
        {selectedMountain.detail && (
          <p className="text-slate-600 leading-relaxed mb-4">
            {selectedMountain.detail}
          </p>
        )}
        {selectedMountain.page_url && (
          <a
            href={selectedMountain.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 font-semibold hover:text-green-800 transition-colors"
          >
            詳細ページを見る
          </a>
        )}
      </div>
    );
  }

  if (selectedPath) {
    return (
      <div className="p-5">
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-2 mb-4 text-sm text-green-700 font-semibold hover:text-green-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          一覧に戻る
        </button>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">
          経路: {selectedPath.type}
        </h2>
        <p className="text-sm text-slate-600">ID: {selectedPath.id}</p>
        <p className="text-sm text-slate-600">OSM ID: {selectedPath.osm_id}</p>
        {selectedPath.minlat && selectedPath.minlon && (
          <p className="text-sm text-slate-600">
            最小座標: 緯度 {selectedPath.minlat}, 経度 {selectedPath.minlon}
          </p>
        )}
        {selectedPath.maxlat && selectedPath.maxlon && (
          <p className="text-sm text-slate-600">
            最大座標: 緯度 {selectedPath.maxlat}, 経度 {selectedPath.maxlon}
          </p>
        )}
        <p className="text-sm text-slate-600">
          ポイント数: {selectedPath.geometries?.length || 0}
        </p>
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
                className="w-full text-left p-5 hover:bg-green-50 cursor-pointer transition-colors"
              >
                <h3 className="font-bold text-slate-700">{mountain.name}</h3>
                {mountain.elevation && (
                  <p className="text-sm text-slate-500">
                    標高: {mountain.elevation.toLocaleString()}m
                  </p>
                )}
                {mountain.prefectures && (
                  <p className="text-sm text-slate-500">
                    都道府県: {mountain.prefectures.map(p => p.name).join(", ")}
                  </p>
                )}
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
