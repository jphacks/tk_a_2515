import type {
  BearSighting,
  Mountain,
  Path,
  PathDetail,
} from "@/app/api/lib/models";
import PanelContent from "./PanelContent";

type Props = {
  mountains: Mountain[];
  allMountains: Mountain[];
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
  showOnlyFavorites: boolean;
  onToggleShowOnlyFavorites: () => void;
  favorites: Mountain[];
};

export default function ContextPanel({
  mountains,
  allMountains,
  visibleMountainIds,
  selectedMountain,
  selectedPath,
  selectedBear,
  onSelectMountain,
  onSelectPath,
  onSelectBear,
  onClearSelection,
  onHoverPointChange,
  isFavorite,
  onToggleFavorite,
  showOnlyFavorites,
  onToggleShowOnlyFavorites,
  favorites,
}: Props) {
  return (
    <aside className="hidden md:block w-96 bg-white border-r border-slate-200 overflow-hidden flex-shrink-0">
      <div className="h-full flex flex-col">
        <PanelContent
          mountains={mountains}
          allMountains={allMountains}
          visibleMountainIds={visibleMountainIds}
          selectedMountain={selectedMountain}
          selectedPath={selectedPath}
          selectedBear={selectedBear}
          onSelectMountain={onSelectMountain}
          onSelectPath={onSelectPath}
          onSelectBear={onSelectBear}
          onClearSelection={onClearSelection}
          onHoverPointChange={onHoverPointChange}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          showOnlyFavorites={showOnlyFavorites}
          onToggleShowOnlyFavorites={onToggleShowOnlyFavorites}
          favorites={favorites}
        />
      </div>
    </aside>
  );
}
