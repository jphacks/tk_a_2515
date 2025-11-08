interface HeaderProps {
  onOpenTutorial: () => void;
}

export default function Header({ onOpenTutorial }: HeaderProps) {
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
      <button
        onClick={onOpenTutorial}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors shadow-lg cursor-pointer"
        title="チュートリアルを表示"
        type="button"
      >
        <span className="text-lg font-bold">?</span>
      </button>
    </header>
  );
}
