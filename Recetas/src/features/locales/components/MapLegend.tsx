import React, { useState } from 'react';
import { 
  Leaf, 
  Fish, 
  Wheat, 
  Milk, 
  Compass, 
  Layers, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

interface MapLegendProps {
  className?: string;
  defaultExpanded?: boolean;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  className = '',
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const legendItems = [
    {
      icon: Leaf,
      label: 'Verdulería y Huerta',
      color: 'bg-emerald-600',
    },
    {
      icon: Fish,
      label: 'Pescadería y Caleta',
      color: 'bg-sky-600',
    },
    {
      icon: Wheat,
      label: 'Tostaduría y Frutos Secos',
      color: 'bg-amber-600',
    },
    {
      icon: Milk,
      label: 'Quesería y Lácteos',
      color: 'bg-yellow-600',
    },
    {
      icon: Compass,
      label: 'Tu Ubicación GPS',
      color: 'bg-blue-600',
      isGps: true,
    },
  ];

  return (
    <div
      className={`rounded-2xl mp-card border mp-border shadow-xl backdrop-blur-xl transition-all duration-300 pointer-events-auto ${className}`}
    >
      {/* Legend Toggle Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left cursor-pointer select-none"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold mp-text-title tracking-tight">
            Leyenda del Mapa
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="size-3.5 mp-text-muted" />
        ) : (
          <ChevronDown className="size-3.5 mp-text-muted" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t mp-border space-y-2 animate-in fade-in duration-200">
          {legendItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                <div className="relative size-5 rounded-full flex items-center justify-center shrink-0 text-white">
                  {item.isGps ? (
                    <div className="size-4 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center">
                      <div className="size-1.5 rounded-full bg-white" />
                    </div>
                  ) : (
                    <div className={`size-4.5 rounded-full ${item.color} flex items-center justify-center border border-white/80 shadow-xs`}>
                      <Icon className="size-2.5" />
                    </div>
                  )}
                </div>
                <span className="font-medium leading-none">{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

