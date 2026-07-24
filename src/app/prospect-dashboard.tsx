"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, BarChart3, Eye, EyeOff, Filter, History, MapPin, Search, X } from "lucide-react";
import { BusinessDetailPanel } from "@/components/business-detail-panel";
import { ProspectMap } from "@/components/prospect-map";
import { ThemeToggle } from "@/components/theme-provider";
import {
  CATEGORY_META,
  MAX_LIVE_SEARCH_CATEGORIES,
  getCategoryOptionGroups,
  isCategorySelectionDisabled,
} from "@/lib/categories";
import {
  filterProspects,
  hasActiveProspectFilters as hasActiveProspectFilterState,
  resolveSelectedProspect,
  resolveSelectionAfterFilterReset,
} from "@/lib/prospect-filters";
import { getScorePillClasses } from "@/lib/scoring";
import { calculateTicketMetrics } from "@/lib/tickets";
import type { Business, BusinessCategory, Ticket } from "@/lib/types";

const categoryGroups = getCategoryOptionGroups();
const VIEWED_PROSPECTS_STORAGE_KEY = "voice-ai-prospect-map:viewed-prospects";

type ViewedProspect = Pick<Business, "id" | "name" | "category" | "borough" | "voiceAiScore"> & {
  viewedAt: string;
};

export function ProspectDashboard({ initialBusinesses }: { initialBusinesses: Business[] }) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [selectedBusinessId, setSelectedBusinessId] = useState(initialBusinesses[0]?.id ?? "");
  const [prospectQuery, setProspectQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BusinessCategory | "all">("all");
  const [minimumScore, setMinimumScore] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchArea, setSearchArea] = useState("");
  const [targetCategories, setTargetCategories] = useState<BusinessCategory[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [searchMessage, setSearchMessage] = useState("Showing the prepared UK-wide saved prospect map. Enter an area only when you want a targeted live Google Places search.");
  const [datasetLabel, setDatasetLabel] = useState("Saved map · UK-wide · All verticals");
  const [viewedProspects, setViewedProspects] = useState<ViewedProspect[]>([]);
  const [focusSelectedOnly, setFocusSelectedOnly] = useState(false);

  useEffect(() => {
    const loadViewedProspects = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(VIEWED_PROSPECTS_STORAGE_KEY);
        if (saved) setViewedProspects(JSON.parse(saved) as ViewedProspect[]);
      } catch (error) {
        console.error("Failed to load viewed prospects", error);
      }
    }, 0);

    return () => window.clearTimeout(loadViewedProspects);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function refreshData() {
      try {
        const [businessResponse, ticketResponse, meResponse] = await Promise.all([
          fetch("/api/businesses"),
          fetch("/api/tickets"),
          fetch("/api/me"),
        ]);
        const businessData = (await businessResponse.json()) as { businesses?: Business[] };
        const ticketData = (await ticketResponse.json()) as { tickets?: Ticket[] };
        const meData = (await meResponse.json()) as { tier?: string };

        if (!ignore) {
          if (businessData.businesses?.length) setBusinesses(businessData.businesses);
          if (ticketData.tickets) setTickets(ticketData.tickets);
          setIsAdmin(meData.tier === "admin");
        }
      } catch (error) {
        console.error("Failed to refresh dashboard data", error);
      }
    }

    refreshData();

    return () => {
      ignore = true;
    };
  }, []);

  const prospectFilters = useMemo(
    () => ({ query: prospectQuery, categoryFilter, minimumScore }),
    [categoryFilter, minimumScore, prospectQuery],
  );
  const hasActiveProspectFilters = hasActiveProspectFilterState(prospectFilters);
  const filteredBusinesses = useMemo(() => filterProspects(businesses, prospectFilters), [businesses, prospectFilters]);

  const selectedBusiness = resolveSelectedProspect({
    businesses,
    filteredBusinesses,
    selectedBusinessId,
    hasActiveFilters: hasActiveProspectFilters,
  });
  const selectedBusinessIdForUi = selectedBusiness?.id ?? "";

  const mapBusinesses = useMemo(() => {
    if (!focusSelectedOnly || !selectedBusiness) return filteredBusinesses;
    return [selectedBusiness];
  }, [filteredBusinesses, focusSelectedOnly, selectedBusiness]);

  const ticketStatusByBusinessId = useMemo(() => {
    const statusByBusinessId = new Map<string, Ticket["status"]>();
    for (const ticket of tickets) {
      if (!statusByBusinessId.has(ticket.businessId)) statusByBusinessId.set(ticket.businessId, ticket.status);
    }
    return statusByBusinessId;
  }, [tickets]);

  const ticketMetrics = useMemo(() => calculateTicketMetrics(tickets), [tickets]);
  const highPriorityCount = businesses.filter((business) => business.voiceAiScore >= 7).length;
  const averageScore = businesses.length
    ? Math.round(businesses.reduce((total, business) => total + business.voiceAiScore, 0) / businesses.length)
    : 0;
  const sortedVisibleBusinesses = useMemo(
    () => [...filteredBusinesses].sort((a, b) => b.voiceAiScore - a.voiceAiScore),
    [filteredBusinesses],
  );

  const toggleTargetCategory = useCallback((category: BusinessCategory) => {
    setTargetCategories((current) => {
      const next = current.includes(category)
        ? current.filter((value) => value !== category)
        : isCategorySelectionDisabled(current, category)
          ? current
          : [...current, category];
      if (next.length) {
        const label = next.length === 1 ? CATEGORY_META[next[0]].label : `${next.length} verticals`;
        setSearchStatus("idle");
        setSearchMessage(`${label} selected. Click Search live data to replace the saved map with fresh Google Places results.`);
      } else {
        setSearchStatus("idle");
        setSearchMessage("All saved verticals selected. Click Show saved map to browse the prepared map without live API calls.");
      }
      return next;
    });
  }, []);

  const showAllTargetCategories = useCallback(() => {
    setTargetCategories([]);
    setSearchStatus("idle");
    setSearchMessage("All saved verticals selected. Click Show saved map to browse the prepared map without live API calls.");
  }, []);

  const selectBusiness = useCallback((business: Business) => {
    setSelectedBusinessId(business.id);
    setViewedProspects((currentViewedProspects) => {
      const nextViewedProspects: ViewedProspect[] = [
        {
          id: business.id,
          name: business.name,
          category: business.category,
          borough: business.borough,
          voiceAiScore: business.voiceAiScore,
          viewedAt: formatViewedDate(new Date()),
        },
        ...currentViewedProspects.filter((prospect) => prospect.id !== business.id),
      ].slice(0, 6);

      try {
        window.localStorage.setItem(VIEWED_PROSPECTS_STORAGE_KEY, JSON.stringify(nextViewedProspects));
      } catch (error) {
        console.error("Failed to persist viewed prospects", error);
      }

      return nextViewedProspects;
    });
  }, []);

  const resetProspectFilters = useCallback(() => {
    setProspectQuery("");
    setCategoryFilter("all");
    setMinimumScore(0);
    setFocusSelectedOnly(false);
    setSelectedBusinessId((currentSelectedBusinessId) =>
      resolveSelectionAfterFilterReset(businesses, currentSelectedBusinessId),
    );
  }, [businesses]);

  function runPersonalizedSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  async function runSearch() {
    const normalizedSearchArea = searchArea.trim();
    if (targetCategories.length > 0 && !normalizedSearchArea) {
      setSearchStatus("error");
      setSearchMessage("Enter an area or postcode before running a targeted live Google Places search.");
      return;
    }

    setSearchStatus("loading");
    setSearchMessage(
      targetCategories.length === 0
        ? "Loading the saved prospect map across all verticals. This does not use Google Places or AI tokens."
        : "Searching validated public business data. This is rate-limited and cached to control API cost.",
    );

    try {
      if (targetCategories.length === 0) {
        const response = await fetch("/api/businesses");
        const data = (await response.json()) as { businesses?: Business[]; error?: string };
        if (!response.ok || !data.businesses?.length) throw new Error(data.error ?? "No saved businesses returned.");

        const restoredBusinesses = data.businesses;
        setBusinesses(restoredBusinesses);
        selectBusiness(restoredBusinesses[0]);
        setDatasetLabel("Saved map · UK-wide · All verticals");
        setCategoryFilter("all");
        setProspectQuery("");
        setMinimumScore(0);
        setFocusSelectedOnly(false);
        setSearchStatus("success");
        setSearchMessage(
          `Showing all ${restoredBusinesses.length} saved prospects across every vertical. No live API call used.`,
        );
        return;
      }

      const response = await fetch("/api/prospect-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: normalizedSearchArea, categories: targetCategories }),
      });
      const data = (await response.json()) as { businesses?: Business[]; source?: string; error?: string; limitRemaining?: number };

      if (!response.ok || !data.businesses?.length) {
        throw new Error(data.error ?? "No businesses returned for this search.");
      }

      setBusinesses(data.businesses);
      selectBusiness(data.businesses[0]);
      setDatasetLabel(`Live ${data.source === "google_places_cache" ? "Google Places cache" : data.source === "google_places_live" ? "Google Places" : "stored fallback"} · ${targetCategories.length === 1 ? CATEGORY_META[targetCategories[0]].label : `${targetCategories.length} verticals`} · ${normalizedSearchArea}`);
      setCategoryFilter("all");
      setProspectQuery("");
      setMinimumScore(0);
      setFocusSelectedOnly(false);
      setSearchStatus("success");
      const sourceLabel = data.source === "google_places_live" ? "live Google Places" : data.source === "google_places_cache" ? "cached Google Places" : "stored fallback";
      const verticalsLabel = targetCategories.length === 1 ? CATEGORY_META[targetCategories[0]].label : `${targetCategories.length} verticals`;
      setSearchMessage(`Loaded ${data.businesses.length} ${sourceLabel} prospects for ${verticalsLabel} in ${normalizedSearchArea}. Searches left this hour: ${data.limitRemaining ?? "tracked"}.`);
    } catch (error) {
      setSearchStatus("error");
      setSearchMessage(error instanceof Error ? error.message : "Search failed. The prepared demo dataset is still available.");
    }
  }

  async function openTicket(business: Business) {
    const ticket: Ticket = {
      id: `open-${business.id}`,
      businessId: business.id,
      businessName: business.name,
      score: business.voiceAiScore,
      status: "open",
      createdAt: formatTicketDate(new Date()),
    };

    setTickets((currentTickets) => {
      if (currentTickets.some((currentTicket) => currentTicket.businessId === business.id && currentTicket.status === "open")) {
        return currentTickets;
      }

      return [ticket, ...currentTickets.filter((currentTicket) => currentTicket.businessId !== business.id)];
    });

    const savedTicket = await persistTicket(ticket);
    if (!savedTicket) {
      setTickets((currentTickets) => currentTickets.filter((currentTicket) => currentTicket.id !== ticket.id));
      setSearchStatus("error");
      setSearchMessage("Could not save that ticket. Try again after the live prospects finish saving, or reload the saved map.");
      return;
    }

    setTickets((currentTickets) => [savedTicket, ...currentTickets.filter((currentTicket) => currentTicket.businessId !== business.id)]);
  }

  async function rejectBusiness(business: Business) {
    const ticket: Ticket = {
      id: `lost-${business.id}`,
      businessId: business.id,
      businessName: business.name,
      score: business.voiceAiScore,
      status: "lost",
      createdAt: formatTicketDate(new Date()),
    };

    setTickets((currentTickets) => [ticket, ...currentTickets.filter((currentTicket) => currentTicket.businessId !== business.id)]);
    const savedTicket = await persistTicket(ticket);
    if (!savedTicket) {
      setTickets((currentTickets) => currentTickets.filter((currentTicket) => currentTicket.id !== ticket.id));
      setSearchStatus("error");
      setSearchMessage("Could not save that review decision. Try again after the live prospects finish saving, or reload the saved map.");
      return;
    }

    setTickets((currentTickets) => [savedTicket, ...currentTickets.filter((currentTicket) => currentTicket.businessId !== business.id)]);
  }

  if (businesses.length === 0) {
    return (
      <main className="min-h-screen text-slate-100">
        <section className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">No prospects loaded</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">The map is waiting for prospect data.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Try refreshing the page or checking the database connection. The app now guards this state instead of crashing.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const hasOpenTicket = selectedBusiness
    ? tickets.some((ticket) => ticket.businessId === selectedBusiness.id && ticket.status === "open")
    : false;

  return (
    <main className="min-h-screen text-slate-100">
      <section className="app-page-shell flex flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
                Prioritise Voice AI prospects by area, urgency, and fit.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                A geospatial prospect intelligence MVP for finding which UK businesses deserve human outreach first.
                Public signals create the shortlist; people make the final call.
              </p>
            </div>
            <div className="flex w-fit items-center gap-3">
              <ThemeToggle />
              <Link
                href="/tickets"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"
              >
                Review pipeline <BarChart3 className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/suryak02/voice-ai-prospect-radar"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                GitHub repo <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <KpiCard label="Visible prospects" value={filteredBusinesses.length.toString()} detail={`${businesses.length} total · ${datasetLabel}`} />
            <KpiCard label="High-priority leads" value={highPriorityCount.toString()} detail="Scored 7-9 for human review" />
            <KpiCard label="Average score" value={`${averageScore}/9`} detail="Across current public-signal set" />
          </div>
        </header>

        <section className="rounded-[2rem] border border-indigo-300/15 bg-indigo-300/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/80">Live Google Places search</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">Pick an area, then choose up to six business types.</h2>
              <p className="mt-1.5 text-sm leading-5 text-slate-400">
                Google Places supplies the businesses; the Leaflet vector map only renders them. Saved-map mode costs nothing, targeted searches are rate-limited and cached.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold text-slate-300">
                {datasetLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold text-slate-300">
                {targetCategories.length === 0 ? "Saved map" : `${targetCategories.length}/${MAX_LIVE_SEARCH_CATEGORIES} selected`}
              </span>
            </div>
          </div>

          <form
            onSubmit={runPersonalizedSearch}
            aria-busy={searchStatus === "loading"}
            className="mt-3 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-start"
          >
            <label className="flex min-h-[4.75rem] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-400">
              <MapPin className="h-5 w-5 shrink-0 text-indigo-300" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Area or postcode</span>
                <input
                  value={searchArea}
                  onChange={(event) => setSearchArea(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  placeholder="e.g. NW1, Hackney, Manchester"
                  className="mt-2 w-full bg-transparent font-medium text-white outline-none placeholder:text-slate-600"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={searchStatus === "loading"}
              aria-busy={searchStatus === "loading"}
              className="min-h-[4.75rem] rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-slate-500"
            >
              {searchStatus === "loading" ? "Searching..." : targetCategories.length === 0 ? "Show saved map" : "Search live data"}
            </button>

            <div className="xl:col-span-2">
              <CategorySearchPicker selected={targetCategories} onToggle={toggleTargetCategory} onShowAll={showAllTargetCategories} />
            </div>
          </form>

          <p
            role={searchStatus === "error" ? "alert" : "status"}
            aria-live={searchStatus === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            className={`mt-3 rounded-2xl border px-4 py-2.5 text-sm ${
              searchStatus === "error"
                ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                : searchStatus === "success"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : "border-white/10 bg-black/20 text-slate-400"
            }`}
          >
            {searchMessage}
          </p>
        </section>

        <section className="dashboard-workspace-grid">
          <aside className="order-2 space-y-4 xl:order-none xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Filter className="h-4 w-4 text-indigo-300" /> Filters
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
                  <Search className="h-4 w-4 shrink-0 text-slate-500" />
                  <input
                    value={prospectQuery}
                    onChange={(event) => setProspectQuery(event.target.value)}
                    maxLength={80}
                    aria-label="Search visible prospects"
                    placeholder="Search name, area, address, vertical"
                    className="w-full bg-transparent font-medium text-slate-100 outline-none placeholder:text-slate-600"
                  />
                  {prospectQuery && (
                    <button
                      type="button"
                      onClick={() => setProspectQuery("")}
                      aria-label="Clear prospect search"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
                  <Search className="h-4 w-4 text-slate-500" />
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value as BusinessCategory | "all")}
                    className="w-full bg-transparent font-medium text-slate-100 outline-none"
                  >
                    <option value="all" className="bg-slate-950 text-white">
                      All verticals
                    </option>
                    {categoryGroups.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
                  <div className="flex items-center justify-between gap-3">
                    <span>Minimum score</span>
                    <span className="font-black text-white">{minimumScore}/9</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="9"
                    value={minimumScore}
                    onChange={(event) => setMinimumScore(Number(event.target.value))}
                    className="mt-3 w-full accent-indigo-400"
                  />
                </label>
                {hasActiveProspectFilters && (
                  <button
                    type="button"
                    onClick={resetProspectFilters}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </button>
                )}
              </div>
            </div>

            <ProspectList
              businesses={sortedVisibleBusinesses}
              totalCount={businesses.length}
              selectedBusinessId={selectedBusinessIdForUi}
              onSelectBusiness={selectBusiness}
              onClearFilters={resetProspectFilters}
              hasActiveFilters={hasActiveProspectFilters}
            />

            <PreviouslyViewed
              prospects={viewedProspects}
              businesses={businesses}
              selectedBusinessId={selectedBusinessIdForUi}
              onSelectBusiness={selectBusiness}
            />
          </aside>

          <div className="order-1 min-w-0 xl:order-none">
            <ProspectMap
              businesses={mapBusinesses}
              selectedBusinessId={selectedBusinessIdForUi}
              onSelectBusiness={selectBusiness}
              ticketStatusByBusinessId={ticketStatusByBusinessId}
              controls={{
                categoryFilter,
                onCategoryFilter: setCategoryFilter,
                prospectQuery,
                onProspectQuery: setProspectQuery,
                onClearFilters: resetProspectFilters,
                hasActiveFilters: hasActiveProspectFilters,
                minimumScore,
                onMinimumScore: setMinimumScore,
                searchArea,
                onSearchArea: setSearchArea,
                targetCategories,
                onToggleCategory: toggleTargetCategory,
                onShowAllCategories: showAllTargetCategories,
                onSearch: runSearch,
                searchStatus,
                searchMessage,
                visibleCount: mapBusinesses.length,
                totalCount: businesses.length,
              }}
            />
          </div>

          <div className="order-3 space-y-6 xl:order-none xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setFocusSelectedOnly((current) => !current)}
                aria-pressed={focusSelectedOnly}
                disabled={!selectedBusiness}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  focusSelectedOnly
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                    : "border-white/10 bg-black/20 text-slate-300 hover:bg-white/[0.06]"
                } disabled:opacity-55`}
              >
                <span className="flex items-center gap-2">
                  {focusSelectedOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {!selectedBusiness
                    ? "No selected prospect visible"
                    : focusSelectedOnly
                      ? "Focused on selected business"
                      : "Show only selected on map"}
                </span>
                <span className="text-xs font-medium text-slate-500">{focusSelectedOnly ? "On" : "Off"}</span>
              </button>
              <p className="mt-2 px-1 text-xs leading-5 text-slate-500">
                Useful after opening a ticket: hide the rest of the territory and keep the map centred on one business.
              </p>
            </div>
            {selectedBusiness ? (
              <BusinessDetailPanel
                business={selectedBusiness}
                onOpenTicket={openTicket}
                onReject={rejectBusiness}
                hasOpenTicket={hasOpenTicket}
                canUseDeepResearch={isAdmin}
              />
            ) : (
              <NoMatchingProspectPanel onClearFilters={resetProspectFilters} />
            )}
            <ReviewPipelineSummary metrics={ticketMetrics} />
          </div>
        </section>
      </section>
    </main>
  );
}

async function persistTicket(ticket: Ticket): Promise<Ticket | null> {
  try {
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: ticket.businessId,
        businessName: ticket.businessName,
        score: ticket.score,
        status: ticket.status,
      }),
    });

    const data = (await response.json()) as { ticket?: Ticket; error?: string };
    if (!response.ok || !data.ticket) throw new Error(data.error ?? "Ticket API did not return a saved ticket.");
    return data.ticket;
  } catch (error) {
    console.error("Failed to persist ticket", error);
    return null;
  }
}

function formatTicketDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatViewedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function NoMatchingProspectPanel({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <section className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">No selected prospect</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">No businesses match these filters.</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Clear the filters to bring the full territory back, or loosen the search, score, or vertical filter from the left rail.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        <X className="h-4 w-4" /> Clear filters
      </button>
    </section>
  );
}

function ReviewPipelineSummary({ metrics }: { metrics: ReturnType<typeof calculateTicketMetrics> }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">Human review</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Outreach pipeline</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Ticket details now live on a dedicated board, keeping the map focused while still showing follow-up momentum.
          </p>
        </div>
        <BarChart3 className="h-5 w-5 text-indigo-300" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <MiniMetric label="Open" value={metrics.byStatus.open.toString()} />
        <MiniMetric label="Contacted" value={metrics.byStatus.contacted.toString()} />
        <MiniMetric label="Won" value={metrics.byStatus.won.toString()} />
        <MiniMetric label="Lost" value={metrics.byStatus.lost.toString()} />
      </div>

      <Link
        href="/tickets"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        Open review pipeline <ArrowUpRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function KpiCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
      <p className="text-xs leading-4 text-slate-500 sm:text-sm">{label}</p>
      <p className="mt-1.5 whitespace-nowrap text-xl font-black tracking-tight text-white sm:text-3xl">{value}</p>
      <p className="mt-1 hidden text-xs text-slate-500 sm:block">{detail}</p>
    </div>
  );
}

function CategorySearchPicker({
  selected,
  onToggle,
  onShowAll,
}: {
  selected: BusinessCategory[];
  onToggle: (category: BusinessCategory) => void;
  onShowAll: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Business types</span>
        <span className="text-[11px] text-slate-500">
          {selected.length === 0 ? "All saved verticals" : `${selected.length}/${MAX_LIVE_SEARCH_CATEGORIES} selected`}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        <button
          type="button"
          onClick={onShowAll}
          aria-pressed={selected.length === 0}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
            selected.length === 0
              ? "category-chip-active shadow-sm shadow-emerald-950/30"
              : "border-white/10 bg-black/20 text-slate-400 hover:bg-white/[0.06]"
          }`}
        >
          All saved verticals
        </button>
        <div className="grid gap-x-6 gap-y-3 md:grid-cols-2 2xl:grid-cols-3">
          {categoryGroups.map((group) => (
            <div key={group.group} className="min-w-0 border-t border-white/10 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">{group.group}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.options.map((option) => {
                  const isActive = selected.includes(option.value);
                  const disabled = isCategorySelectionDisabled(selected, option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onToggle(option.value)}
                      aria-pressed={isActive}
                      aria-label={disabled ? `${option.label} unavailable. Clear a selected business type first.` : option.label}
                      disabled={disabled}
                      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isActive
                          ? "category-chip-active shadow-sm shadow-indigo-950/30"
                          : disabled
                            ? "cursor-not-allowed border-white/10 bg-black/10 text-slate-600"
                            : "border-white/10 bg-black/20 text-slate-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviouslyViewed({
  prospects,
  businesses,
  selectedBusinessId,
  onSelectBusiness,
}: {
  prospects: ViewedProspect[];
  businesses: Business[];
  selectedBusinessId: string;
  onSelectBusiness: (business: Business) => void;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">History</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Previously viewed</h2>
        </div>
        <History className="h-5 w-5 text-indigo-300" />
      </div>

      {prospects.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-500">
          Click a few map pins or shortlist rows and they will appear here for quick comparison.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {prospects.map((prospect) => {
            const matchingBusiness = businesses.find((business) => business.id === prospect.id);
            const isSelected = prospect.id === selectedBusinessId;

            return (
              <button
                key={prospect.id}
                type="button"
                onClick={() => matchingBusiness && onSelectBusiness(matchingBusiness)}
                disabled={!matchingBusiness}
                className={`w-full rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected ? "border-indigo-300/40 bg-indigo-300/10" : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{prospect.name}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {prospect.category} · {prospect.borough} · {prospect.viewedAt}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${getScorePillClasses(prospect.voiceAiScore)}`}>
                    {prospect.voiceAiScore}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProspectList({
  businesses,
  totalCount,
  selectedBusinessId,
  onSelectBusiness,
  onClearFilters,
  hasActiveFilters,
}: {
  businesses: Business[];
  totalCount: number;
  selectedBusinessId: string;
  onSelectBusiness: (business: Business) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">Ranked shortlist</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Visible prospects</h2>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-slate-400">
          {businesses.length}/{totalCount}
        </span>
      </div>
      <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {businesses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-500">
            No prospects match the current filters.
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          businesses.map((business, index) => {
          const isSelected = business.id === selectedBusinessId;

          return (
            <button
              key={business.id}
              type="button"
              onClick={() => onSelectBusiness(business)}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                isSelected
                  ? "border-indigo-300/40 bg-indigo-300/10"
                  : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">#{index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{business.name}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">
                    {business.category} · {business.borough}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${getScorePillClasses(business.voiceAiScore)}`}>
                  {business.voiceAiScore}
                </span>
              </div>
            </button>
          );
          })
        )}
      </div>
    </section>
  );
}

