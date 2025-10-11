import { useEffect, useRef } from "react";
import PanelContent from "./PanelContent";

// 共通の型定義
type Mountain = {
  id: number;
  name: string;
  elevation: number;
  description: string;
};
type Props = {
  mountains: Mountain[];
  selectedMountain: Mountain | null;
  onSelectMountain: (mountain: Mountain) => void;
  onClearSelection: () => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export default function BottomSheet({
  isOpen,
  onToggle,
  onClose,
  ...props
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // マウスダウンイベントのハンドラ
    const handleClickOutside = (event: MouseEvent) => {
      // refが存在し、クリックされた要素がシートの内側にない場合
      if (
        sheetRef.current &&
        !sheetRef.current.contains(event.target as Node)
      ) {
        onClose(); // 閉じる関数を呼び出す
      }
    };

    // シートが開いている時のみイベントリスナーを追加
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // クリーンアップ関数: コンポーネントがアンマウントされるか、
    // isOpenの状態が変わる前にイベントリスナーを削除する
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={sheetRef}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
    >
      <div
        className={`bg-white rounded-t-2xl shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[70vh]" : "max-h-[90px]"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          onKeyDown={e => e.key === "Enter" && onToggle()}
          className="w-full py-3 flex justify-center cursor-pointer"
          aria-label="Toggle Bottom Sheet"
        >
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto" />
        </button>

        <div
          className={`overflow-y-auto max-h-[calc(70vh-36px)] pb-4 ${!isOpen && "overflow-hidden"}`}
        >
          <PanelContent {...props} />
        </div>
      </div>
    </div>
  );
}
