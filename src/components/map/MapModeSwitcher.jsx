import React, { useMemo } from 'react';
import { Map as MapIcon, Satellite, Mountain, Box, Globe2, Flame, Layers } from 'lucide-react';
import { MAP_MODES, supportsWebGL2 } from './mapModes';

const MODE_ICONS = {
  street: MapIcon,
  satellite: Satellite,
  terrain: Mountain,
  terrain3d: Box,
  globe: Globe2,
  heatmap: Flame,
};

const LAYER_TOGGLES = [
  { key: 'labels', label: 'Well labels' },
  { key: 'allWells', label: 'Other wells' },
  { key: 'radius', label: 'Radius circle' },
  { key: 'hillshade', label: 'Hillshade', modes: ['terrain', 'terrain3d'] },
];

export default function MapModeSwitcher({ mapMode, onModeChange, layers, onToggleLayer }) {
  const webgl2 = useMemo(supportsWebGL2, []);

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
      <div
        role="radiogroup"
        aria-label="Map mode"
        className="bg-white/95 backdrop-blur rounded-lg border border-line shadow-sm p-1 flex flex-wrap gap-0.5 max-w-[calc(100vw-2rem)]"
      >
        {Object.entries(MAP_MODES).map(([key, mode]) => {
          const Icon = MODE_ICONS[key] || MapIcon;
          const disabled = mode.requiresWebGL2 && !webgl2;
          const active = mapMode === key;
          return (
            <button
              key={key}
              role="radio"
              aria-checked={active}
              disabled={disabled}
              title={disabled ? `${mode.label} needs WebGL2` : mode.label}
              onClick={() => onModeChange(key)}
              className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-600 disabled:opacity-40 disabled:cursor-not-allowed ${
                active ? 'bg-royal-700 text-white' : 'text-ink-600 hover:bg-royal-100 hover:text-royal-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {mode.label}
            </button>
          );
        })}
      </div>

      <details className="bg-white/95 backdrop-blur rounded-lg border border-line shadow-sm text-[11px] group">
        <summary className="cursor-pointer select-none px-2.5 py-1.5 flex items-center gap-1.5 font-medium text-royal-900 list-none">
          <Layers className="w-3.5 h-3.5 text-royal-700" aria-hidden="true" /> Layers
        </summary>
        <div className="px-2.5 pb-2 pt-1 space-y-1 border-t border-line">
          {LAYER_TOGGLES.filter((t) => !t.modes || t.modes.includes(mapMode)).map((t) => (
            <label key={t.key} className="flex items-center gap-2 text-ink-900 cursor-pointer">
              <input
                type="checkbox"
                checked={!!layers[t.key]}
                onChange={() => onToggleLayer(t.key)}
                className="accent-royal-700"
              />
              {t.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
