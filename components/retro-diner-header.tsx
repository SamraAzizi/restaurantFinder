"use client"

import { Utensils } from "lucide-react"

export default function RetroDinerHeader() {
  return (
    <header className="mb-10 relative">
      <div className="bg-gradient-to-b from-teal-400 to-teal-500 border-4 border-black rounded-[6px] shadow-[6px_6px_0px_0px_black] p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-3 flex">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? "bg-red-500" : "bg-white"}`} />
          ))}
        </div>

        <div className="relative z-10 pt-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="bg-red-500 border-[3px] border-black px-4 py-1 rounded-full shadow-[3px_3px_0px_0px_black]">
              <span className="text-white font-bold text-sm tracking-wider uppercase">Est. 2025</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="bg-[#fff8e7] border-[3px] border-black p-3 rounded-full shadow-[3px_3px_0px_0px_black]">
                <div className="bg-[#ff867c] border-2 border-black p-2 rounded-full">
                  <Utensils className="h-8 w-8 text-white" strokeWidth={2.5} />
                </div>
              </div>

              <div className="relative inline-block text-left">
                <h1
                  className="text-4xl sm:text-5xl font-black text-white tracking-tight"
                  style={{
                    textShadow: "3px 3px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000",
                    fontStyle: "italic",
                    letterSpacing: "0.02em",
                  }}
                >
                  Restaurant
                </h1>
                <div
                  className="text-5xl sm:text-6xl font-black text-yellow-300 -mt-1"
                  style={{
                    textShadow: "3px 3px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000",
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic",
                  }}
                >
                  Finder
                </div>
              </div>
            </div>

            <div className="relative inline-block">
              <div className="bg-[#ff867c] border-2 border-black px-6 py-2 shadow-[2px_2px_0px_0px_black] relative">
                <div className="absolute -left-3 top-0 bottom-0 w-3 bg-[#ff867c] border-2 border-black border-r-0 clip-ribbon-left" />
                <div className="absolute -right-3 top-0 bottom-0 w-3 bg-[#ff867c] border-2 border-black border-l-0 clip-ribbon-right" />
                <p className="text-white font-bold text-sm sm:text-base tracking-wide uppercase">Find Your Next Comfort Spot</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-3 flex">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? "bg-red-500" : "bg-white"}`} />
          ))}
        </div>
      </div>

      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-300 border-[3px] border-black px-6 py-1 rounded-full shadow-[3px_3px_0px_0px_black] z-20">
        <span className="font-black text-black text-sm uppercase tracking-wider">Open 24/7</span>
      </div>
    </header>
  )
}