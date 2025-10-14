// components/CSSVisualizer.tsx - IMPROVED VERSION

import { useEffect, useState } from 'react';

interface CSSVisualizerProps {
  isPlaying: boolean;
  currentTime?: number; // ← ADD THIS
  barCount?: number;
}

export default function CSSVisualizer({ 
  isPlaying, 
  currentTime = 0,
  barCount = 48 
}: CSSVisualizerProps) {
  const [heights, setHeights] = useState<number[]>(
    Array.from({ length: barCount }, () => 20)
  );

  useEffect(() => {
    if (!isPlaying) {
      // Fade to minimum when paused
      setHeights(prev => prev.map(h => Math.max(h * 0.9, 8)));
      return;
    }

    // Simulate beat detection based on time
    const interval = setInterval(() => {
      const beatPhase = (currentTime * 2) % 1; // 120 BPM simulation
      const isBeat = beatPhase < 0.1; // Beat hits every ~0.5s

      setHeights(prev => 
        prev.map((h, i) => {
          // Wave pattern across bars
          const wave = Math.sin((currentTime + i * 0.1) * 3) * 30 + 50;
          
          // Beat boost
          const beatBoost = isBeat ? 40 : 0;
          
          // Smooth interpolation
          const target = wave + beatBoost;
          return h + (target - h) * 0.2;
        })
      );
    }, 50); // 20 FPS

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, barCount]);

  return (
    <div className="flex items-center justify-center gap-1 h-24 bg-gradient-to-b from-gray-900/50 to-black/50 rounded-lg p-4 backdrop-blur-sm border border-white/5 mb-4">
      {heights.map((height, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-purple-500 via-pink-500 to-indigo-500 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(8, Math.min(95, height))}%`,
            opacity: isPlaying ? 1 : 0.3
          }}
        />
      ))}
    </div>
  );
}