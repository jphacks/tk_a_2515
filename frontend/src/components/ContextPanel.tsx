import type {
  BearSighting,
  Mountain,
  Path,
  PathDetail,
} from "@/app/api/lib/models";
import PanelContent from "./PanelContent";

type Props = {
  mountains: Mountain[];
  selectedMountain: Mountain | null;
  selectedPath?: PathDetail | null;
  selectedBear?: BearSighting | null;
  onSelectMountain: (mountain: Mountain) => void;
  onSelectPath?: (path: Path) => void;
  onSelectBear?: (bear: BearSighting) => void;
  onClearSelection: () => void;
  onHoverPointChange?: (point: { lat: number; lon: number } | null) => void;
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
