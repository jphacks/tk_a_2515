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
        {!selectedMountain && !selectedPath && !selectedBear && (
          <div className="p-3 border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={onToggleShowOnlyFavorites}
              className={`w-full px-3 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                showOnlyFavorites
                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`w-4 h-4 ${showOnlyFavorites ? "text-yellow-500" : "text-gray-400"}`}
              >
                <title>お気に入りのみ表示</title>
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
              {showOnlyFavorites
                ? `お気に入り (${favorites.length}件)`
                : "お気に入りのみ表示"}
            </button>
          </div>
        )}
        <PanelContent
          mountains={mountains}
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
        />
      </div>
    </aside>
  );
}
