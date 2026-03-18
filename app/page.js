"use client";

import Link from "next/link";
import NewsList from "@/components/NewsList";
import NewsTitle from "@/components/NewsTitle";
import MarketOverview from "@/components/MarketOverview";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-800 py-12 px-2 md:px-0">
      <div className="max-w-3xl mx-auto space-y-10">
        <section className="rounded-2xl shadow-xl bg-gray-800/80 p-6 border border-gray-700">
          <MarketOverview />
        </section>

        <section className="rounded-2xl shadow-xl bg-gray-800/80 p-6 border border-gray-700">
          <NewsTitle />
          <div className="mt-4">
            <NewsList />
          </div>
        </section>

        <div className="flex justify-center">
          <Link href="/chart">
            <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-full shadow-lg hover:scale-105 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200">
              Open Chart Dashboard
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
