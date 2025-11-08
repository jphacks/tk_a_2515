interface HeaderProps {
  onOpenTutorial: () => void;
  onOpenFavorites: () => void;
  favoritesCount: number;
}

export default function Header({
  onOpenTutorial,
  onOpenFavorites,
  favoritesCount,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-12 px-6 bg-gradient-to-r from-green-500 to-green-200 shadow-md z-50 shrink-0">
      <div className="flex items-center gap-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          className="text-green-100 w-8 h-8 shrink-0"
        >
          <title>PeakSight</title>
          <path d="M320.5 64C335.2 64 348.7 72.1 355.7 85L571.7 485C578.4 497.4 578.1 512.4 570.9 524.5C563.7 536.6 550.6 544 536.6 544L104.6 544C90.5 544 77.5 536.6 70.3 524.5C63.1 512.4 62.8 497.4 69.5 485L285.5 85L288.4 80.4C295.7 70.2 307.6 64 320.5 64zM234.4 313.9L261.2 340.7C267.4 346.9 277.6 346.9 283.8 340.7L327.1 297.4C333.1 291.4 341.2 288 349.7 288L392.5 288L320.4 154.5L234.3 313.9z" fill="white" />
        </svg>
        <h1 className="text-xl font-bold text-green-100 tracking-tight">
          PeakSight
        </h1>
      </div>
      <div className="flex items-center gap-4 h-9">
        <button
          type="button"
          onClick={onOpenFavorites}
          className="flex items-center gap-2 h-full px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors relative cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-yellow-500"
          >
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
          お気に入り
          {favoritesCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {favoritesCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenTutorial}
          className="flex items-center gap-2 h-full px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <span className="text-base font-bold">?</span>
        </button>
      </div>
    </header>
  );
}
