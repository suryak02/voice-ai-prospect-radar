"use client";

import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { Maximize2, MapPin, X } from "lucide-react";
import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { MapControls, type MapControlsProps } from "@/components/map-controls";
import { useTheme } from "@/components/theme-provider";
import { getScoreColorClasses, getScoreLabel } from "@/lib/scoring";
import type { Business, Ticket } from "@/lib/types";

type MapViewport = { north: number; south: number; east: number; west: number };

// Safety cap on simultaneously rendered markers; viewport culling keeps the
// in-view count well below this in practice.
const MAX_RENDERED_MARKERS = 300;

type ProspectMapProps = {
  businesses: Business[];
  selectedBusinessId: string;
  onSelectBusiness: (business: Business) => void;
  controls?: MapControlsProps;
  ticketStatusByBusinessId?: Map<string, Ticket["status"]>;
};

const mapBounds = {
  north: 51.565,
  south: 51.495,
  west: -0.125,
  east: 0.015,
};

const londonCenter = { lat: 51.528, lng: -0.055 };

const googleMapOptions = {
  clickableIcons: false,
  disableDefaultUI: true,
  gestureHandling: "greedy",
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#111827" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#263244" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f2437" }] },
  ],
};

const googleMapOptionsLight = {
  ...googleMapOptions,
  styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
};

function positionForBusiness(business: Business) {
  const x = ((business.longitude - mapBounds.west) / (mapBounds.east - mapBounds.west)) * 100;
  const y = ((mapBounds.north - business.latitude) / (mapBounds.north - mapBounds.south)) * 100;

  return {
    left: `${Math.max(4, Math.min(96, x))}%`,
    top: `${Math.max(5, Math.min(95, y))}%`,
  };
}

export function ProspectMap({ businesses, selectedBusinessId, onSelectBusiness, controls, ticketStatusByBusinessId }: ProspectMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId) ?? businesses[0];

  return (
    <>
      <MapCanvas
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        onSelectBusiness={onSelectBusiness}
        selectedBusiness={selectedBusiness}
        onExpand={() => setIsExpanded(true)}
        variant="embedded"
        ticketStatusByBusinessId={ticketStatusByBusinessId}
      />

      {isExpanded && (
        <div className="fixed inset-0 z-50 flex gap-3 bg-black/80 p-3 backdrop-blur-xl sm:gap-4 sm:p-6">
          {controls && (
            <div className="hidden w-[340px] shrink-0 lg:block">
              <MapControls {...controls} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <MapCanvas
              businesses={businesses}
              selectedBusinessId={selectedBusinessId}
              onSelectBusiness={onSelectBusiness}
              selectedBusiness={selectedBusiness}
              onExpand={() => setIsExpanded(false)}
              variant="expanded"
              ticketStatusByBusinessId={ticketStatusByBusinessId}
            />
          </div>
        </div>
      )}
    </>
  );
}

const ProspectMarker = memo(ProspectMarkerBase);

type MapCanvasProps = ProspectMapProps & {
  selectedBusiness?: Business;
  onExpand: () => void;
  variant: "embedded" | "expanded";
};

function MapCanvas({
  businesses,
  selectedBusinessId,
  onSelectBusiness,
  selectedBusiness,
  onExpand,
  variant,
  ticketStatusByBusinessId,
}: MapCanvasProps) {
  const isExpanded = variant === "expanded";
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-maps-script",
    googleMapsApiKey: googleMapsApiKey ?? "",
  });
  const canRenderGoogleMap = Boolean(googleMapsApiKey && isLoaded && !loadError);
  const { theme } = useTheme();
  const mapOptions = theme === "light" ? googleMapOptionsLight : googleMapOptions;

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);

  // Frame the map to the current result set whenever it changes, so searching a
  // new area (e.g. Manchester) flies there instead of staying fixed on London.
  useEffect(() => {
    if (!map || businesses.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const business of businesses) {
      bounds.extend({ lat: business.latitude, lng: business.longitude });
    }
    map.fitBounds(bounds, window.innerWidth < 640 ? 36 : 64);
    // Clamp the auto-fit once it settles: a tight cluster shouldn't slam to
    // street level, and a single result still gets a close view.
    const listener = google.maps.event.addListenerOnce(map, "idle", () => {
      const zoom = map.getZoom() ?? 6;
      const maxZoom = businesses.length === 1 ? 15 : 13;
      if (zoom > maxZoom) map.setZoom(maxZoom);
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, businesses]);

  // Only render markers inside the current viewport (plus the selected one) so a
  // dense result set stays smooth as the user pans and zooms.
  const visibleBusinesses = useMemo(() => {
    const withinViewport = viewport
      ? businesses.filter(
          (business) =>
            business.latitude <= viewport.north &&
            business.latitude >= viewport.south &&
            business.longitude <= viewport.east &&
            business.longitude >= viewport.west,
        )
      : businesses;

    const capped = withinViewport.slice(0, MAX_RENDERED_MARKERS);
    if (selectedBusiness && !capped.some((business) => business.id === selectedBusiness.id)) {
      capped.push(selectedBusiness);
    }
    return capped;
  }, [businesses, viewport, selectedBusiness]);

  const regionLabel = useMemo(() => {
    if (!businesses.length) return "United Kingdom";
    const counts = new Map<string, number>();
    for (const business of businesses) counts.set(business.borough, (counts.get(business.borough) ?? 0) + 1);
    let best = "United Kingdom";
    let bestCount = 0;
    for (const [borough, count] of counts) {
      if (count > bestCount) {
        best = borough;
        bestCount = count;
      }
    }
    return best;
  }, [businesses]);

  return (
    <section
      className={`relative overflow-hidden border border-white/10 bg-[#07090d] shadow-2xl shadow-black/30 ${
        isExpanded
          ? "h-full rounded-[2rem]"
          : "min-h-[460px] rounded-[2rem] sm:min-h-[560px] lg:min-h-[640px] xl:sticky xl:top-5 xl:self-start xl:h-[calc(100vh-2.5rem)] xl:min-h-[600px]"
      }`}
    >
      {canRenderGoogleMap ? (
        <GoogleMap
          mapContainerClassName="absolute inset-0 h-full w-full"
          options={mapOptions}
          onLoad={(instance) => {
            // Uncontrolled view: set a sensible initial frame, then let the
            // fitBounds effect own zoom/center (no controlled props to fight it).
            instance.setCenter(londonCenter);
            instance.setZoom(6);
            setMap(instance);
          }}
          onUnmount={() => setMap(null)}
          onIdle={() => {
            const currentBounds = map?.getBounds();
            if (!currentBounds) return;
            const northEast = currentBounds.getNorthEast();
            const southWest = currentBounds.getSouthWest();
            setViewport({
              north: northEast.lat(),
              east: northEast.lng(),
              south: southWest.lat(),
              west: southWest.lng(),
            });
          }}
        >
          {visibleBusinesses.map((business) => (
            <OverlayView
              key={business.id}
              position={{ lat: business.latitude, lng: business.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <ProspectMarker
                business={business}
                isSelected={business.id === selectedBusinessId}
                isExpanded={isExpanded}
                ticketStatus={ticketStatusByBusinessId?.get(business.id)}
                onSelectBusiness={onSelectBusiness}
              />
            </OverlayView>
          ))}
        </GoogleMap>
      ) : (
        <>
          <iframe
            title="East and Central London prospect map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapBounds.west}%2C${mapBounds.south}%2C${mapBounds.east}%2C${mapBounds.north}&layer=mapnik`}
            className="absolute inset-0 h-full w-full border-0 opacity-95 saturate-90 contrast-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-slate-950/10" />
          {businesses.slice(0, MAX_RENDERED_MARKERS).map((business) => (
            <ProspectMarker
              key={business.id}
              business={business}
              isSelected={business.id === selectedBusinessId}
              isExpanded={isExpanded}
              ticketStatus={ticketStatusByBusinessId?.get(business.id)}
              onSelectBusiness={onSelectBusiness}
              style={positionForBusiness(business)}
            />
          ))}
        </>
      )}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(2,6,23,0.05),rgba(2,6,23,0.24))]" />

      <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-5.5rem)] rounded-2xl border border-white/10 bg-black/45 px-3 py-2.5 shadow-2xl backdrop-blur-xl sm:left-8 sm:top-8 sm:px-4 sm:py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/80">Live prospect layer</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">
          {regionLabel}
        </h2>
        <p className="mt-1 hidden max-w-sm text-xs leading-5 text-slate-400 sm:block sm:text-sm">
          {isExpanded
            ? "Expanded command view for scanning territories and opening review tickets."
            : "Tap expand for a Google Maps-style dedicated scanning experience."}
        </p>
      </div>

      <button
        type="button"
        onClick={onExpand}
        className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-xl transition hover:bg-white/[0.12] sm:right-8 sm:top-8 sm:px-4 sm:text-sm"
      >
        {isExpanded ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        {isExpanded ? "Close map" : "Expand map"}
      </button>

      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-3 sm:bottom-8 sm:left-8 sm:right-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="hidden grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/45 p-3 text-xs text-slate-300 shadow-2xl backdrop-blur-xl sm:grid sm:flex sm:w-fit sm:grid-cols-none">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-500" />0-2 poor</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sky-500" />3-4 low</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" />5-6 promising</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500" />7-8 strong</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-fuchsia-500" />9 highest</span>
        </div>

        {selectedBusiness && (
          <div className="rounded-2xl border border-white/10 bg-black/55 p-3 shadow-2xl backdrop-blur-xl sm:p-4 lg:w-80">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Selected</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{selectedBusiness.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{selectedBusiness.category} · {selectedBusiness.borough}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-950">
                {selectedBusiness.voiceAiScore}/9
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type ProspectMarkerProps = {
  business: Business;
  isSelected: boolean;
  isExpanded: boolean;
  onSelectBusiness: (business: Business) => void;
  ticketStatus?: Ticket["status"];
  style?: CSSProperties;
};

function ProspectMarkerBase({ business, isSelected, isExpanded, onSelectBusiness, ticketStatus, style }: ProspectMarkerProps) {
  return (
    <button
      type="button"
      onClick={() => onSelectBusiness(business)}
      className={`${style ? "absolute" : "relative"} z-10 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 transition hover:scale-110 focus:outline-none focus:ring-8 ${getScoreColorClasses(
        business.voiceAiScore,
      )} ${isSelected ? "scale-[1.45] ring-8 ring-indigo-200/70" : ""} ${ticketStatus === "open" ? "outline outline-2 outline-emerald-300/80" : ""} ${ticketStatus === "contacted" ? "outline outline-2 outline-sky-300/80" : ""} ${ticketStatus === "won" ? "outline outline-2 outline-violet-300/80" : ""} ${ticketStatus === "lost" ? "outline outline-2 outline-rose-300/80" : ""}`}
      style={style}
      aria-label={`Select ${business.name}, score ${business.voiceAiScore}`}
    >
      <span
        className={`grid place-items-center font-black ${isExpanded ? "h-14 w-14 text-base" : "h-11 w-11 text-sm"} ${
          ticketStatus === "open"
            ? "text-emerald-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.55)]"
            : ticketStatus === "contacted"
              ? "text-sky-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.55)]"
              : ticketStatus === "won"
                ? "text-violet-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.55)]"
                : ticketStatus === "lost"
                  ? "text-rose-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.55)]"
                  : ""
        }`}
      >
        {business.voiceAiScore}
      </span>
      {isSelected && (
        <span className="absolute left-1/2 top-14 min-w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-[#101114]/95 px-3 py-2 text-left text-xs font-semibold text-slate-100 shadow-2xl backdrop-blur-xl">
          <span className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
            <span>
              {business.name}
              <span className="mt-1 block text-[11px] font-medium text-slate-400">
                {ticketStatus === "open" ? "Open ticket" : ticketStatus === "contacted" ? "Contacted" : ticketStatus === "won" ? "Won" : ticketStatus === "lost" ? "Lost" : getScoreLabel(business.voiceAiScore)} · {business.borough}
              </span>
            </span>
          </span>
        </span>
      )}
    </button>
  );
}
