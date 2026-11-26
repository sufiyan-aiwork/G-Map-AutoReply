import React, { useState, useEffect } from 'react';

/**
 * Official TechZone Academy logo container referencing /techzone_logo.png
 * in frontend/public/. Preserves original logo colors and 1:1 aspect ratio
 * using object-contain on a high-contrast surface, with a clean typographic
 * fallback if the asset is unavailable.
 */
export default function BrandLogo({
  size = 'md', // 'sm' | 'md' | 'lg'
  surface = 'dark', // 'dark' | 'light'
  src = '/techzone_logo.png',
  className = '',
}) {
  const [imageMissing, setImageMissing] = useState(false);

  useEffect(() => {
    setImageMissing(false);
  }, [src]);

  const sizeMap = {
    sm: 'w-11 h-11 text-xs rounded-xl',
    md: 'w-11 h-11 text-sm rounded-xl',
    lg: 'w-24 h-24 text-xl rounded-2xl',
  };

  const frameClass = imageMissing
    ? surface === 'dark'
      ? 'bg-white/10 border border-white/20 text-white shadow-md shadow-black/20'
      : 'bg-[#eff6fb] border border-[#b9d7ef] text-[#025091] shadow-sm'
    : surface === 'dark'
    ? 'bg-white border border-white/80 shadow-md shadow-black/20'
    : 'bg-white border border-[#e2e8f0] shadow-sm';

  return (
    <div
      className={`aspect-square shrink-0 overflow-hidden flex items-center justify-center select-none ${
        sizeMap[size] || sizeMap.md
      } ${frameClass} ${className}`}
    >
      {!imageMissing ? (
        <img
          src={src}
          alt="TechZone Academy logo"
          onError={() => setImageMissing(true)}
          className="w-full h-full object-contain scale-[1.2]"
        />
      ) : (
        <span className="font-heading font-bold tracking-tight leading-none">
          TZ
        </span>
      )}
    </div>
  );
}
