"use client";

import type { FormEvent } from "react";
import { Filter, Search, X } from "lucide-react";
import { MAX_LIVE_SEARCH_CATEGORIES, getCategoryOptionGroups, isCategorySelectionDisabled } from "@/lib/categories";
import type { BusinessCategory } from "@/lib/types";

const categoryGroups = getCategoryOptionGroups();
export type MapControlsProps = {
  categoryFilter: BusinessCategory | "all";
  onCategoryFilter: (value: BusinessCategory | "all") => void;
  prospectQuery: string;
  onProspectQuery: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  minimumScore: number;
  onMinimumScore: (value: number) => void;
  searchArea: string;
  onSearchArea: (value: string) => void;
  targetCategories: BusinessCategory[];
  onToggleCategory: (category: BusinessCategory) => void;
  onShowAllCategories: () => void;
  onSearch: () => void;
  searchStatus: "idle" | "loading" | "success" | "error";
  searchMessage: string;
  visibleCount: number;
  totalCount: number;
};

/**
 * On-the-fly filters + live search, shown as a sidebar inside the expanded map
 * so the territory can be re-filtered and re-searched without closing the map.
 */
export function MapControls({
  categoryFilter,
  onCategoryFilter,
  prospectQuery,
  onProspectQuery,
  onClearFilters,
  hasActiveFilters,
  minimumScore,
  onMinimumScore,
  searchArea,
  onSearchArea,
  targetCategories,
  onToggleCategory,
  onShowAllCategories,
  onSearch,
  searchStatus,
  searchMessage,
  visibleCount,
  totalCount,
}: MapControlsProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch();
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">On-the-fly controls</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{visibleCount}/{totalCount} visible</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Filter className="h-4 w-4 text-indigo-300" /> Filters
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={prospectQuery}
            onChange={(event) => onProspectQuery(event.target.value)}
            maxLength={80}
            aria-label="Search visible prospects"
            placeholder="Search prospects"
            className="w-full bg-transparent font-medium text-slate-100 outline-none placeholder:text-slate-600"
          />
          {prospectQuery && (
            <button
              type="button"
              onClick={() => onProspectQuery("")}
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
            onChange={(event) => onCategoryFilter(event.target.value as BusinessCategory | "all")}
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
            onChange={(event) => onMinimumScore(Number(event.target.value))}
            className="mt-3 w-full accent-indigo-400"
          />
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="text-sm font-semibold text-slate-200">Live search</div>
        <label className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Area</span>
          <input
            value={searchArea}
            onChange={(event) => onSearchArea(event.target.value)}
            minLength={2}
            maxLength={80}
            placeholder="e.g. Hackney, Manchester, Bristol"
            className="mt-2 w-full bg-transparent font-medium text-white outline-none placeholder:text-slate-600"
          />
        </label>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Business types</span>
            <span className="text-[11px] text-slate-500">
              {targetCategories.length}/{MAX_LIVE_SEARCH_CATEGORIES}
            </span>
          </div>
          <div className="mt-3 space-y-3">
            <button
              type="button"
              onClick={onShowAllCategories}
              aria-pressed={targetCategories.length === 0}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
                targetCategories.length === 0
                  ? "category-chip-active shadow-sm shadow-emerald-950/30"
                  : "border-white/10 bg-black/20 text-slate-400 hover:bg-white/[0.06]"
              }`}
            >
              All saved verticals
            </button>
            {categoryGroups.map((group) => (
              <div key={group.group} className="border-t border-white/10 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">{group.group}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {group.options.map((option) => {
                    const active = targetCategories.includes(option.value);
                    const disabled = isCategorySelectionDisabled(targetCategories, option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onToggleCategory(option.value)}
                        aria-pressed={active}
                        aria-label={disabled ? `${option.label} unavailable. Clear a selected business type first.` : option.label}
                        disabled={disabled}
                        className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "category-chip-active"
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
        <button
          type="submit"
          disabled={searchStatus === "loading"}
          className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-slate-500"
        >
          {searchStatus === "loading" ? "Searching..." : targetCategories.length === 0 ? "Show saved map" : "Search live data"}
        </button>
        <p
          className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${
            searchStatus === "error"
              ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
              : searchStatus === "success"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border-white/10 bg-black/20 text-slate-400"
          }`}
        >
          {searchMessage}
        </p>
      </form>
    </div>
  );
}
