import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";

export default function CustomMap() {
  return (
    <div className="relative flex-1 bg-slate-200">
      {/* マップコンテナ */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <p className="text-2xl font-semibold text-slate-400 tracking-wider">
          MAP AREA
        </p>
      </div>

      {/* マップコントロール */}
      <div className="absolute bottom-5 right-5 flex flex-col gap-2">
        <button
          type="button"
          className="bg-white p-2.5 rounded-full shadow-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <LocateFixed className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex flex-col bg-white rounded-full shadow-lg">
          <button
            type="button"
            className="p-2.5 hover:bg-slate-100 transition-colors rounded-t-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
          >
            <ZoomIn className="h-5 w-5 text-slate-600" />
          </button>
          <hr />
          <button
            type="button"
            className="p-2.5 hover:bg-slate-100 transition-colors rounded-b-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
          >
            <ZoomOut className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
