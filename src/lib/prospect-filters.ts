import { CATEGORY_META } from "./categories";
import type { Business, BusinessCategory } from "./types";

export type ProspectFilterState = {
  query: string;
  categoryFilter: BusinessCategory | "all";
  minimumScore: number;
};

export function hasActiveProspectFilters({ query, categoryFilter, minimumScore }: ProspectFilterState) {
  return query.trim().length > 0 || categoryFilter !== "all" || minimumScore > 0;
}

export function businessMatchesProspectQuery(business: Business, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    business.name,
    business.address,
    business.borough,
    business.category,
    CATEGORY_META[business.category].label,
    business.recommendedUseCase,
    ...business.reviewPainSignals,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function filterProspects(businesses: Business[], filters: ProspectFilterState) {
  return businesses.filter((business) => {
    const categoryMatches = filters.categoryFilter === "all" || business.category === filters.categoryFilter;
    return (
      categoryMatches &&
      business.voiceAiScore >= filters.minimumScore &&
      businessMatchesProspectQuery(business, filters.query)
    );
  });
}

export function resolveSelectedProspect({
  businesses,
  filteredBusinesses,
  selectedBusinessId,
  hasActiveFilters,
}: {
  businesses: Business[];
  filteredBusinesses: Business[];
  selectedBusinessId: string;
  hasActiveFilters: boolean;
}) {
  return (
    filteredBusinesses.find((business) => business.id === selectedBusinessId) ??
    filteredBusinesses[0] ??
    (!hasActiveFilters ? businesses.find((business) => business.id === selectedBusinessId) ?? businesses[0] : undefined)
  );
}

export function resolveSelectionAfterFilterReset(businesses: Business[], selectedBusinessId: string) {
  if (businesses.some((business) => business.id === selectedBusinessId)) return selectedBusinessId;
  return businesses[0]?.id ?? "";
}
