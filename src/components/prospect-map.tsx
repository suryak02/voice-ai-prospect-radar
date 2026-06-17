"use client";

import type { CircleMarker, LayerGroup, Map as LeafletMap, TileLayer } from "leaflet";
import { Maximize2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapControls, type MapControlsProps } from "@/components/map-controls";
import { useTheme } from "@/components/theme-provider";
import { getScoreLabel } from "@/lib/scoring";
import type { Business, Ticket } from "@/lib/types";

type ProspectMapProps = {
  businesses: Business[];
  selectedBusinessId: string;
  onSelectBusiness: (business: Business) => void;
  controls?: MapControlsProps;
  ticketStatusByBusinessId?: Map<string, Ticket["status"]>;
};

type MapCanvasProps = ProspectMapProps & {
  onExpand: () => void;
  variant: "embedded" | "expanded";
};

const MAX_RENDERED_MARKERS = 1200;
const londonCenter: [number, number] = [51.528, -0.055];
const UK_WIDE_LATITUDE_SPAN = 1.25;
const UK_WIDE_LONGITUDE_SPAN = 1.5;

const tileSources = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
};

const scoreMarkerStyles = [
  { max: 2, fill: "#475569", stroke: "#cbd5e1", text: "#f8fafc" },
  { max: 4, fill: "#0ea5e9", stroke: "#bae6fd", text: "#082f49" },
  { max: 6, fill: "#facc15", stroke: "#fef3c7", text: "#422006" },
  { max: 8, fill: "#f43f5e", stroke: "#fecdd3", text: "#fff1f2" },
  { max: 9, fill: "#d946ef", stroke: "#fae8ff", text: "#fff7ff" },
];

const ticketOutlineColors: Record<Ticket["status"], string> = {
  open: "#6ee7b7",
  contacted: "#7dd3fc",
  won: "#c4b5fd",
  lost: "#fda4af",
};

function markerStyleForScore(score: number) {
  return scoreMarkerStyles.find((style) => score <= style.max) ?? scoreMarkerStyles[scoreMarkerStyles.length - 1];
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function popupHtml(business: Business, ticketStatus?: Ticket["status"]): string {
  const statusLabel = ticketStatus
    ? ticketStatus === "open"
      ? "Open ticket"
      : ticketStatus === "contacted"
        ? "Contacted"
        : ticketStatus === "won"
          ? "Won"
          : "Lost"
    : getScoreLabel(business.voiceAiScore);

  return `
    <div class="map-leaflet-popup">
      <div class="map-leaflet-popup-header">
        <strong>${escapeHtml(business.name)}</strong>
        <span>${escapeHtml(business.voiceAiScore)}/9</span>
      </div>
      <p>${escapeHtml(business.address)}</p>
      <dl>
        <div><dt>Fit</dt><dd>${escapeHtml(statusLabel)}</dd></div>
        <div><dt>Vertical</dt><dd>${escapeHtml(business.category.replace(/_/g, " "))}</dd></div>
        <div><dt>Area</dt><dd>${escapeHtml(business.borough)}</dd></div>
      </dl>
    </div>
  `;
}

function buildRegionLabel(businesses: Business[]): string {
  if (!businesses.length) return "United Kingdom";

  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;
  const areaCounts = new Map<string, number>();

  for (const business of businesses) {
    minLatitude = Math.min(minLatitude, business.latitude);
    maxLatitude = Math.max(maxLatitude, business.latitude);
    minLongitude = Math.min(minLongitude, business.longitude);
    maxLongitude = Math.max(maxLongitude, business.longitude);

    const area = business.borough.trim();
    if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  }

  const latitudeSpan = maxLatitude - minLatitude;
  const longitudeSpan = maxLongitude - minLongitude;
  if (
    businesses.length > 1 &&
    (areaCounts.size >= 4 || latitudeSpan >= UK_WIDE_LATITUDE_SPAN || longitudeSpan >= UK_WIDE_LONGITUDE_SPAN)
  ) {
    return "United Kingdom";
  }

  let bestArea = "United Kingdom";
  let bestCount = 0;
  for (const [area, count] of areaCounts) {
    if (count > bestCount) {
      bestArea = area;
      bestCount = count;
    }
  }

  return bestArea;
}

export function ProspectMap({ businesses, selectedBusinessId, onSelectBusiness, controls, ticketStatusByBusinessId }: ProspectMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isExpanded]);

  return (
    <>
      <MapCanvas
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        onSelectBusiness={onSelectBusiness}
        onExpand={() => setIsExpanded(true)}
        variant="embedded"
        ticketStatusByBusinessId={ticketStatusByBusinessId}
      />

      {isExpanded && (
        <div className="map-expanded-shell fixed inset-0 z-[3000] flex h-[100dvh] min-h-0 gap-3 overflow-hidden p-0 backdrop-blur-xl sm:gap-4 sm:p-6">
          {controls && (
            <div className="hidden h-full min-h-0 w-[340px] shrink-0 overflow-hidden lg:block">
              <MapControls {...controls} />
            </div>
          )}
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <MapCanvas
              businesses={businesses}
              selectedBusinessId={selectedBusinessId}
              onSelectBusiness={onSelectBusiness}
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

function MapCanvas({
  businesses,
  selectedBusinessId,
  onSelectBusiness,
  onExpand,
  variant,
  ticketStatusByBusinessId,
}: MapCanvasProps) {
  const isExpanded = variant === "expanded";
  const { theme } = useTheme();
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const markerRef = useRef<Map<string, CircleMarker>>(new Map());
  const lastFitKeyRef = useRef("");
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [mapError, setMapError] = useState("");

  const renderedBusinesses = useMemo(() => businesses.slice(0, MAX_RENDERED_MARKERS), [businesses]);
  const renderedBusinessKey = useMemo(() => renderedBusinesses.map((business) => business.id).join("|"), [renderedBusinesses]);

  const regionLabel = useMemo(() => buildRegionLabel(businesses), [businesses]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;
    let cancelled = false;
    const markerRegistry = markerRef.current;

    async function initMap() {
      try {
        const L = await import("leaflet");
        if (!mapElementRef.current || cancelled) return;

        const map = L.map(mapElementRef.current, {
          attributionControl: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          preferCanvas: true,
          scrollWheelZoom: true,
          zoomControl: false,
        }).setView(londonCenter, 6);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.attribution({ prefix: false, position: "bottomleft" }).addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setMapReadyTick((tick) => tick + 1);
      } catch (error) {
        console.error("Leaflet map failed to initialize", error);
        setMapError("The vector map could not load.");
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      markerRegistry.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function updateTiles() {
      const map = mapRef.current;
      if (!map) return;
      const L = await import("leaflet");
      if (cancelled) return;

      const source = theme === "light" ? tileSources.light : tileSources.dark;
      tileLayerRef.current?.remove();
      tileLayerRef.current = L.tileLayer(source.url, {
        attribution: source.attribution,
        maxZoom: 20,
        subdomains: "abcd",
      }).addTo(map);
      tileLayerRef.current.setZIndex(1);
    }

    void updateTiles();

    return () => {
      cancelled = true;
    };
  }, [mapReadyTick, theme]);

  useEffect(() => {
    let cancelled = false;

    async function drawMarkers() {
      const map = mapRef.current;
      const markerLayer = markerLayerRef.current;
      if (!map || !markerLayer) return;
      const L = await import("leaflet");
      if (cancelled) return;

      markerLayer.clearLayers();
      markerRef.current.clear();

      for (const business of renderedBusinesses) {
        const isSelected = business.id === selectedBusinessId;
        const ticketStatus = ticketStatusByBusinessId?.get(business.id);
        const markerStyle = markerStyleForScore(business.voiceAiScore);
        const radius = isExpanded ? (isSelected ? 12 : 9) : isSelected ? 10 : 7;
        const weight = isSelected ? 4 : ticketStatus ? 3 : 2;

        const marker = L.circleMarker([business.latitude, business.longitude], {
          bubblingMouseEvents: false,
          color: ticketStatus ? ticketOutlineColors[ticketStatus] : markerStyle.stroke,
          fillColor: markerStyle.fill,
          fillOpacity: ticketStatus === "lost" ? 0.45 : 0.9,
          opacity: ticketStatus === "lost" ? 0.72 : 1,
          radius,
          weight,
        }).bindPopup(popupHtml(business, ticketStatus), { maxWidth: 320 });

        marker.on("click", () => {
          onSelectBusiness(business);
          marker.openPopup();
        });

        marker.addTo(markerLayer);
        markerRef.current.set(business.id, marker);
      }

      const selectedMarker = markerRef.current.get(selectedBusinessId);
      if (selectedMarker) {
        selectedMarker.bringToFront();
        if (!selectedMarker.isPopupOpen()) selectedMarker.openPopup();
      }

      if (renderedBusinesses.length && renderedBusinessKey !== lastFitKeyRef.current) {
        map.fitBounds(renderedBusinesses.map((business) => [business.latitude, business.longitude] as [number, number]), {
          maxZoom: renderedBusinesses.length === 1 ? 15 : 13,
          padding: [isExpanded ? 72 : 48, isExpanded ? 72 : 48],
        });
        lastFitKeyRef.current = renderedBusinessKey;
      }
    }

    void drawMarkers();

    return () => {
      cancelled = true;
    };
  }, [isExpanded, mapReadyTick, onSelectBusiness, renderedBusinesses, renderedBusinessKey, selectedBusinessId, ticketStatusByBusinessId]);

  useEffect(() => {
    if (!mapRef.current) return;
    window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
  }, [isExpanded]);

  return (
    <section
      className={`map-canvas-shell relative overflow-hidden border shadow-2xl shadow-black/30 ${
        isExpanded
          ? "h-full min-h-0 rounded-none sm:rounded-[2rem]"
          : "min-h-[460px] rounded-[2rem] sm:min-h-[560px] lg:min-h-[640px] xl:sticky xl:top-5 xl:self-start xl:h-[calc(100vh-2.5rem)] xl:min-h-[600px]"
      }`}
    >
      <div ref={mapElementRef} className="absolute inset-0 h-full w-full" aria-label="Prospect map" />
      {mapError && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/80 p-8 text-center text-sm text-slate-300">
          {mapError}
        </div>
      )}
      <div className="map-canvas-scrim pointer-events-none absolute inset-0" />

      <div className="absolute left-3 right-3 top-3 z-[500] flex items-start gap-2 sm:left-8 sm:right-8 sm:top-8">
        <div className="map-overlay-card min-w-0 flex-1 rounded-2xl border px-3 py-2.5 shadow-2xl backdrop-blur-xl sm:max-w-md sm:px-4 sm:py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/80">Live prospect layer</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">{regionLabel}</h2>
          <p className="mt-1 hidden max-w-sm text-xs leading-5 text-slate-400 sm:block sm:text-sm">
            {isExpanded
              ? "Expanded command view using canvas-backed vector markers for smoother scanning."
              : "Tap expand for a dedicated scanning experience with vector map markers."}
          </p>
        </div>

        <button
          type="button"
          onClick={onExpand}
          className="map-action-button inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-2xl backdrop-blur-xl transition hover:bg-white/[0.12] sm:px-4 sm:text-sm"
        >
          {isExpanded ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isExpanded ? "Close map" : "Expand map"}
        </button>
      </div>

      <div className="absolute bottom-3 left-3 right-[5.75rem] z-[500] flex flex-col items-start gap-3 sm:bottom-8 sm:left-8 sm:right-[6.75rem]">
        <div className="map-overlay-card hidden grid-cols-2 gap-2 rounded-2xl border p-3 text-xs text-slate-300 shadow-2xl backdrop-blur-xl sm:grid sm:flex sm:w-fit sm:grid-cols-none">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-500" />0-2 poor</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sky-500" />3-4 low</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" />5-6 promising</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500" />7-8 strong</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-fuchsia-500" />9 highest</span>
        </div>
      </div>
    </section>
  );
}
