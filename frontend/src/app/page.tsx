"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import ContextPanel from "@/components/ContextPanel";
import Header from "@/components/Header";
import CustomMap from "@/components/Map";

// サンプルデータ型
type Mountain = {
  id: number;
  name: string;
  elevation: number;
  description: string;
};

// サンプルデータ
const sampleMountains: Mountain[] = [
  {
    id: 1,
    name: "富士山",
    elevation: 3776,
    description:
      "日本一高い山であり、その美しい円錐形の姿は日本の象徴です。古くから信仰の対象とされ、多くの芸術作品に描かれてきました。",
  },
  {
    id: 2,
    name: "北岳",
    elevation: 3193,
    description:
      "南アルプスに位置し、富士山に次ぐ日本で2番目に高い山です。高山植物の宝庫としても知られています。",
  },
  {
    id: 3,
    name: "穂高岳",
    elevation: 3190,
    description:
      "北アルプスの盟主として知られ、奥穂高岳、涸沢岳、北穂高岳などの峰々からなります。険しい岩稜帯が特徴です。",
  },
  {
    id: 4,
    name: "槍ヶ岳",
    elevation: 3180,
    description:
      "天を突く槍のような鋭い山頂が特徴的な北アルプスのシンボル的存在です。多くの登山者の憧れの的となっています。",
  },
];

export default function HomePage() {
  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(
    null,
  );

  const handleSelectMountain = (mountain: Mountain) => {
    setSelectedMountain(mountain);
  };

  const handleClearSelection = () => {
    setSelectedMountain(null);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <ContextPanel
          mountains={sampleMountains}
          selectedMountain={selectedMountain}
          onSelectMountain={handleSelectMountain}
          onClearSelection={handleClearSelection}
        />
        <CustomMap />
      </main>
      <BottomSheet
        mountains={sampleMountains}
        selectedMountain={selectedMountain}
        onSelectMountain={handleSelectMountain}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
}
