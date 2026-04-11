'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { useEffect, useState } from 'react';

// Rich mid-saturation palette matching the 21st.dev reference — teal, lime, coral warmth
const COLORS = ['#72b9bb', '#8cc5b8', '#dbf4a4', '#b5d9d9', '#ffd1bd', '#9ed8cf'];

export function ShaderHero() {
  const [dims, setDims] = useState({ width: 1440, height: 900 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => setDims({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="absolute inset-0">
      {mounted && (
        <MeshGradient
          width={dims.width}
          height={dims.height}
          colors={COLORS}
          distortion={0.8}
          swirl={0.6}
          speed={0.42}
          offsetX={0.08}
          grainMixer={0}
          grainOverlay={0}
        />
      )}
      {/* Minimal dark veil — just enough for white text legibility */}
      <div className="absolute inset-0 bg-black/15" />
    </div>
  );
}
