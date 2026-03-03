"use client";

import dynamic from "next/dynamic";

const TacticalBoard = dynamic(() => import("@/src/TacticalBoard"), {
  ssr: false,
});

export default function Home() {
  return <TacticalBoard />;
}
