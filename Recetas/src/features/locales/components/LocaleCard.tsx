import React from 'react';
import { Card, Chip } from '@heroui/react';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';
import type { Locale } from '../data/locales';

interface LocaleCardProps {
  locale: Locale;
  isSelected?: boolean;
  onSelectOnMap?: () => void;
  userDistance?: string | null;
}

export const LocaleCard: React.FC<LocaleCardProps> = ({
  locale,
  isSelected = false,
  onSelectOnMap,
  userDistance,
}) => {
  const storeUrl = `/marketplace/${locale.id}`;
  const fullAddress = locale.address
    ? `${locale.address}, ${locale.commune || locale.region}`
    : `${locale.commune || ''}, ${locale.region}`;

  const displayDistance = userDistance || locale.distance;

  return (
    <Card
      className={`group relative flex flex-col overflow-hidden rounded-2xl mp-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${isSelected
          ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/10'
          : ''
        }`}
    >
      {/* Clickable Image Container */}
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ver catálogo de ${locale.name}`}
        className="relative block aspect-[16/10] overflow-hidden mp-input"
      >
        <img
          src={locale.image}
          alt={locale.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </a>

      {/* Header Info */}
      <Card.Header className="flex flex-col items-start gap-1.5 p-5 pb-2">
        {/* Title */}
        <Card.Title className="font-serif text-lg font-bold mp-text-title line-clamp-1">
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            {locale.name}
          </a>
        </Card.Title>

        {/* Physical Address (clickable to focus on map) */}
        <button
          type="button"
          onClick={onSelectOnMap}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline text-left cursor-pointer transition-colors"
          title="Ver ubicación en el mapa"
        >
          <MapPin className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="line-clamp-1">{fullAddress}</span>
        </button>

        {/* Description */}
        <Card.Description className="line-clamp-2 text-xs leading-relaxed mp-text-muted mt-0.5">
          {locale.description}
        </Card.Description>
      </Card.Header>

      {/* Tags: Solo ingredientes */}
      <Card.Content className="px-5 py-3 mt-auto">
        <div className="flex flex-wrap gap-1.5">
          {locale.tags.map((ingredient) => (
            <Chip key={ingredient} variant="soft" className="mp-input">
              <Chip.Label className="text-[10px] mp-text-muted uppercase font-semibold tracking-tight">
                {ingredient}
              </Chip.Label>
            </Chip>
          ))}
        </div>
      </Card.Content>

      {/* Footer with Distance, Locate Button & View Catalog Button */}
      <Card.Footer className="border-t mp-border p-4 px-5 flex items-center justify-between gap-2">
        {/* Distance */}
        <div className="flex items-center gap-1 text-xs mp-text-muted font-medium">
          <Navigation className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>A {displayDistance}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onSelectOnMap && (
            <button
              type="button"
              onClick={onSelectOnMap}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold mp-button hover:border-emerald-600 dark:hover:border-emerald-500 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Centrar y ver en el mapa interactivo"
            >
              <MapPin className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Ubicar</span>
            </button>
          )}

          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-sm hover:shadow active:scale-95"
            aria-label={`Abrir catálogo de ${locale.name} en una nueva pestaña`}
          >
            <span>Ver catálogo</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </Card.Footer>
    </Card>
  );
};
