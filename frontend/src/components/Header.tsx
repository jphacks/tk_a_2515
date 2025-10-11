import { Mountain } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center h-16 px-6 bg-white border-b border-slate-200 z-50 shrink-0">
      <div className="flex items-center gap-3">
        <Mountain className="h-7 w-7 text-green-600" />
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          terview
        </h1>
      </div>
    </header>
  );
}
