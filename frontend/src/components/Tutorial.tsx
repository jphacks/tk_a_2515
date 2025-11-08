import { useState } from "react";

interface TutorialSlide {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

const slides: TutorialSlide[] = [
  {
    id: "welcome",
    title: "PeakSight へようこそ",
    description: "山や登山道に関するデータを簡単に閲覧できます．",
    image: "🏔️",
  },
  {
    id: "terrain",
    title: "地形の探索",
    description:
      "3D の地図上に可視化された山や登山道を探索し，標高などの詳細情報を確認できます．",
    image: "🔍",
  },
  {
    id: "bonus",
    title: "ほかに必要な情報も",
    description:
      "登山道の標高グラフやクマの目撃情報など，登山に役立つ追加情報も提供しています．",
    image: "📊",
  },
  {
    id: "start",
    title: "始めましょう",
    description: "準備ができました！PeakSight をご活用ください．",
    image: "🚀",
  },
];

export default function Tutorial({ isOpen, onClose }: TutorialProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("tutorialCompleted", "true");
    }
    setCurrentSlide(0);
    onClose();
  };

  const handleSkip = () => {
    setCurrentSlide(slides.length - 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-green-500 to-green-400 px-6 py-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            チュートリアル
          </h2>
        </div>

        {/* コンテンツ */}
        <div className="p-4 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">
              {slides[currentSlide].image}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">
              {slides[currentSlide].title}
            </h3>
            <p className="text-base sm:text-lg text-gray-600">
              {slides[currentSlide].description}
            </p>
          </div>

          {/* プログレスインジケーター */}
          <div className="flex justify-center gap-2 mb-4 sm:mb-6">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? "w-8 bg-green-500"
                    : "w-2 bg-gray-300"
                }`}
              />
            ))}
          </div>

          {/* チェックボックス */}
          {currentSlide === slides.length - 1 && (
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
                />
                <span className="text-sm sm:text-base text-gray-700">
                  次回以降表示しない
                </span>
              </label>
            </div>
          )}

          {/* ボタン */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrev}
              disabled={currentSlide === 0}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer white-space-nowrap"
              type="button"
            >
              ← 前へ
            </button>

            <div className="flex gap-2">
              {currentSlide < slides.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-800 cursor-pointer white-space-nowrap"
                  type="button"
                >
                  スキップ
                </button>
              )}
              {currentSlide < slides.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer white-space-nowrap"
                  type="button"
                >
                  次へ →
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer white-space-nowrap"
                  type="button"
                >
                  始める
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
