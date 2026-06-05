"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Filter, History, Search } from "lucide-react";
import { BusinessDetailPanel } from "@/components/business-detail-panel";
import { ProspectMap } from "@/components/prospect-map";
import { TicketQueue } from "@/components/ticket-queue";
import { ThemeToggle } from "@/components/theme-provider";
import { CATEGORY_META, getCategoryOptionGroups } from "@/lib/categories";
import { getScorePillClasses } from "@/lib/scoring";
import type { Business, BusinessCategory, Ticket } from "@/lib/types";

const categoryGroups = getCategoryOptionGroups();
const MAX_SEARCH_CATEGORIES = 6;

const VIEWED_PROSPECTS_STORAGE_KEY = "voice-ai-prospect-map:viewed-prospects";

type ViewedProspect = Pick<Business, "id" | "name" | "category" | "borough" | "voiceAiScore"> & {
  viewedAt: string;
};

export function ProspectDashboard({ initialBusinesses }: { initialBusinesses: Business[] }) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [selectedBusinessId, setSelectedBusinessId] = useState(initialBusinesses[0]?.id ?? "");
  const [categoryFilter, setCategoryFilter] = useState<BusinessCategory | "all">("all");
  const [minimumScore, setMinimumScore] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchArea, setSearchArea] = useState("East London");
  const [targetCategories, setTargetCategories] = useState<BusinessCategory[]>(["dental"]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [searchMessage, setSearchMessage] = useState("Showing the prepared London demo dataset. Run a targeted search to personalize the territory.");
  const [viewedProspects, setViewedProspects] = useState<ViewedProspect[]>([]);

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

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      const categoryMatches = categoryFilter === "all" || business.category === categoryFilter;
      return categoryMatches && business.voiceAiScore >= minimumScore;
    });
  }, [businesses, categoryFilter, minimumScore]);

  const selectedBusiness =
    filteredBusinesses.find((business) => business.id === selectedBusinessId) ?? filteredBusinesses[0] ?? businesses[0];

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
      if (current.includes(category)) {
        const next = current.filter((value) => value !== category);
        return next.length ? next : current; // always keep at least one vertical
      }
      if (current.length >= MAX_SEARCH_CATEGORIES) return current;
      return [...current, category];
    });
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

  function runPersonalizedSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  async function runSearch() {
    setSearchStatus("loading");
    setSearchMessage("Searching validated public business data. This is rate-limited and cached to control API cost.");

    try {
      const response = await fetch("/api/prospect-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: searchArea, categories: targetCategories }),
      });
      const data = (await response.json()) as { businesses?: Business[]; source?: string; error?: string; limitRemaining?: number };

      if (!response.ok || !data.businesses?.length) {
        throw new Error(data.error ?? "No businesses returned for this search.");
      }

      setBusinesses(data.businesses);
      selectBusiness(data.businesses[0]);
      setCategoryFilter("all");
      setMinimumScore(0);
      setSearchStatus("success");
      const sourceLabel = data.source === "google_places_live" ? "live Google Places" : data.source === "google_places_cache" ? "cached Google Places" : "stored fallback";
      const verticalsLabel = targetCategories.length === 1 ? CATEGORY_META[targetCategories[0]].label : `${targetCategories.length} verticals`;
      setSearchMessage(`Loaded ${data.businesses.length} ${sourceLabel} prospects for ${verticalsLabel} in ${searchArea}. Searches left this hour: ${data.limitRemaining ?? "tracked"}.`);
    } catch (error) {
      setSearchStatus("error");
      setSearchMessage(error instanceof Error ? error.message : "Search failed. The prepared demo dataset is still available.");
    }
  }

  function openTicket(business: Business) {
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

    persistTicket(ticket);
  }

  function rejectBusiness(business: Business) {
    const ticket: Ticket = {
      id: `rejected-${business.id}`,
      businessId: business.id,
      businessName: business.name,
      score: business.voiceAiScore,
      status: "rejected",
      createdAt: formatTicketDate(new Date()),
    };

    setTickets((currentTickets) => [ticket, ...currentTickets.filter((currentTicket) => currentTicket.businessId !== business.id)]);
    persistTicket(ticket);
  }

  const hasOpenTicket = tickets.some((ticket) => ticket.businessId === selectedBusiness.id && ticket.status === "open");

  return (
    <main className="min-h-screen text-slate-100">
      <section className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-100">
                Elyos UK territory demo
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
                Prioritise Voice AI prospects by area, urgency, and fit.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                A geospatial prospect intelligence MVP for finding which UK businesses deserve human outreach first.
                Public signals create the shortlist; people make the final call.
              </p>
            </div>
            <div className="flex w-fit items-center gap-3">
              <ThemeToggle />
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

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <KpiCard label="Seed businesses" value={businesses.length.toString()} detail="Across UK cities & verticals" />
            <KpiCard label="High-priority leads" value={highPriorityCount.toString()} detail="Scored 7-9 for human review" />
            <KpiCard label="Average score" value={`${averageScore}/9`} detail="Across current public-signal set" />
          </div>
        </header>

        <section className="rounded-[2rem] border border-indigo-300/15 bg-indigo-300/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_1.4fr] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/80">Personalized live search</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Choose a territory and target vertical.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The request is validated, rate-limited, cached, and capped before it can touch Google Places, so the demo feels real without opening a blank cheque on API costs.
              </p>
            </div>

            <form onSubmit={runPersonalizedSearch} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Area</span>
                  <input
                    value={searchArea}
                    onChange={(event) => setSearchArea(event.target.value)}
                    minLength={2}
                    maxLength={80}
                    placeholder="e.g. Hackney, Manchester, Bristol"
                    className="mt-2 w-full bg-transparent font-medium text-white outline-none placeholder:text-slate-600"
                  />
                </label>

                <button
                  type="submit"
                  disabled={searchStatus === "loading"}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-slate-500 sm:self-stretch"
                >
                  {searchStatus === "loading" ? "Searching..." : "Search live data"}
                </button>
              </div>

              <CategorySearchPicker selected={targetCategories} onToggle={toggleTargetCategory} />
            </form>
          </div>

          <p
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
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

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Filter className="h-4 w-4 text-indigo-300" /> Filters
              </div>
              <div className="mt-4 space-y-3">
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
              </div>
            </div>

            <ProspectList
              businesses={sortedVisibleBusinesses}
              selectedBusinessId={selectedBusiness.id}
              onSelectBusiness={selectBusiness}
            />

            <PreviouslyViewed
              prospects={viewedProspects}
              businesses={businesses}
              selectedBusinessId={selectedBusiness.id}
              onSelectBusiness={selectBusiness}
            />
          </aside>

          <ProspectMap
            businesses={filteredBusinesses}
            selectedBusinessId={selectedBusiness.id}
            onSelectBusiness={selectBusiness}
            controls={{
              categoryFilter,
              onCategoryFilter: setCategoryFilter,
              minimumScore,
              onMinimumScore: setMinimumScore,
              searchArea,
              onSearchArea: setSearchArea,
              targetCategories,
              onToggleCategory: toggleTargetCategory,
              onSearch: runSearch,
              searchStatus,
              searchMessage,
              visibleCount: filteredBusinesses.length,
            }}
          />

          <div className="space-y-6 xl:sticky xl:top-5 xl:self-start">
            <BusinessDetailPanel
              business={selectedBusiness}
              onOpenTicket={openTicket}
              onReject={rejectBusiness}
              hasOpenTicket={hasOpenTicket}
              canUseDeepResearch={isAdmin}
            />
            <TicketQueue tickets={tickets} />
          </div>
        </section>
      </section>
    </main>
  );
}

async function persistTicket(ticket: Ticket) {
  try {
    await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: ticket.businessId,
        businessName: ticket.businessName,
        score: ticket.score,
        status: ticket.status,
      }),
    });
  } catch (error) {
    console.error("Failed to persist ticket", error);
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

function KpiCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function CategorySearchPicker({
  selected,
  onToggle,
}: {
  selected: BusinessCategory[];
  onToggle: (category: BusinessCategory) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Business types</span>
        <span className="text-[11px] text-slate-500">
          {selected.length}/{MAX_SEARCH_CATEGORIES} selected
        </span>
      </div>
      <div className="mt-3 max-h-44 space-y-3 overflow-y-auto pr-1">
        {categoryGroups.map((group) => (
          <div key={group.group}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">{group.group}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.options.map((option) => {
                const isActive = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onToggle(option.value)}
                    aria-pressed={isActive}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? "border-indigo-300/40 bg-indigo-300/15 text-indigo-100"
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
  selectedBusinessId,
  onSelectBusiness,
}: {
  businesses: Business[];
  selectedBusinessId: string;
  onSelectBusiness: (business: Business) => void;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">Ranked shortlist</p>
      <h2 className="mt-2 text-lg font-semibold text-white">Visible prospects</h2>
      <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {businesses.map((business, index) => {
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
        })}
      </div>
    </section>
  );
}

