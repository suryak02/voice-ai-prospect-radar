"use client";

import type { FormEvent } from "react";
import { Filter, Search } from "lucide-react";
import { getCategoryOptionGroups } from "@/lib/categories";
import type { BusinessCategory } from "@/lib/types";

const categoryGroups = getCategoryOptionGroups();
const MAX_SEARCH_CATEGORIES = 6;

export type MapControlsProps = {
  categoryFilter: BusinessCategory | "all";
  onCategoryFilter: (value: BusinessCategory | "all") => void;
  minimumScore: number;
  onMinimumScore: (value: number) => void;
  searchArea: string;
  onSearchArea: (value: string) => void;
  targetCategories: BusinessCategory[];
  onToggleCategory: (category: BusinessCategory) => void;
  onSearch: () => void;
  searchStatus: "idle" | "loading" | "success" | "error";
  searchMessage: string;
  visibleCount: number;
};

/**
 * On-the-fly filters + live search, shown as a sidebar inside the expanded map
 * so the territory can be re-filtered and re-searched without closing the map.
 */
export function MapControls({
  categoryFilter,
  onCategoryFilter,
  minimumScore,
  onMinimumScore,
  searchArea,
  onSearchArea,
  targetCategories,
  onToggleCategory,
  onSearch,
  searchStatus,
  searchMessage,
  visibleCount,
}: MapControlsProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch();
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">On-the-fly controls</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{visibleCount} visible</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Filter className="h-4 w-4 text-indigo-300" /> Filters
        </div>
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
              {targetCategories.length}/{MAX_SEARCH_CATEGORIES}
            </span>
          </div>
          <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
            {categoryGroups.map((group) => (
              <div key={group.group}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">{group.group}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {group.options.map((option) => {
                    const active = targetCategories.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onToggleCategory(option.value)}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
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
        <button
          type="submit"
          disabled={searchStatus === "loading"}
          className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-slate-500"
        >
          {searchStatus === "loading" ? "Searching..." : "Search live data"}
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
