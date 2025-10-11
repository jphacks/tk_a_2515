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
};

export default function BottomSheet(props: Props) {
  return (
    // md (768px) 未満の画面でのみ表示
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
      <div className="bg-white rounded-t-2xl shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.1)] transition-all duration-300 max-h-[70vh]">
        <div className="py-3 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>
        <div className="overflow-y-auto max-h-[calc(70vh-36px)] pb-4">
          <PanelContent {...props} />
        </div>
      </div>
    </div>
  );
}
