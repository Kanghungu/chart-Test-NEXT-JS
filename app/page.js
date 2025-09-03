"use client";
import Link from "next/link";
import NewsList from "@/components/NewsList";

export default function Home() {
    return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold text-center">내 프로젝트 메인 화면</h1>
            <p className="text-center text-gray-700">
                여기는 차트가 아닌 첫 페이지입니다. 최신 코인 및 주식 뉴스를 확인할 수 있어요.
            </p>

            <NewsList />

            <div className="text-center">
                <Link href="/chart">
                    <button className="px-6 py-3 bg-blue-500 text-white rounded-xl shadow hover:bg-blue-600">
                        차트 화면으로 이동
                    </button>
                </Link>
            </div>
        </div>
    );
}
