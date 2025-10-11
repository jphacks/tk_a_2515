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

export default function ContextPanel(props: Props) {
  return (
    // md (768px) 以上の画面でのみ表示
    <aside className="hidden md:flex flex-col w-[400px] bg-white border-r border-slate-200 shrink-0">
      <div className="overflow-y-auto">
        <PanelContent {...props} />
      </div>
    </aside>
  );
}
