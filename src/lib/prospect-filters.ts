import { CATEGORY_META } from "./categories";
import type { Business, BusinessCategory } from "./types";

export type ProspectFilterState = {
  query: string;
  categoryFilter: BusinessCategory | "all";
  minimumScore: number;
};

export function normalizeProspectSearchQuery(query: string): string {
  return normalizeSearchText(query.trim().replace(/\s+/g, " "));
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function hasActiveProspectFilters({ query, categoryFilter, minimumScore }: ProspectFilterState) {
  return normalizeProspectSearchQuery(query).length > 0 || categoryFilter !== "all" || minimumScore > 0;
}

export function businessMatchesProspectQuery(business: Business, query: string) {
  const normalizedQuery = normalizeProspectSearchQuery(query);
  if (!normalizedQuery) return true;

  const searchableValues = [
    business.name,
    business.address,
    business.borough,
    business.phone,
    business.website,
    business.category,
    CATEGORY_META[business.category].label,
    business.recommendedUseCase,
    ...business.reviewPainSignals,
  ];

  const searchableText = searchableValues
    .filter((value): value is string => Boolean(value))
    .map(normalizeSearchText);

  if (searchableText.some((value) => value.includes(normalizedQuery))) {
    return true;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (
    queryTokens.length > 1 &&
    queryTokens.every((token) => searchableText.some((value) => value.includes(token)))
  ) {
    return true;
  }

  const queryDigits = normalizeDigits(normalizedQuery);
  if (queryDigits.length < 3) return false;

  const queryVariants = getPhoneNumberVariants(queryDigits);

  return searchableValues.some((value) => {
    const valueDigits = normalizeDigits(value ?? "");
    if (valueDigits.length < 3) return false;
    const valueVariants = getPhoneNumberVariants(valueDigits);
    return valueVariants.some((valueVariant) =>
      queryVariants.some((queryVariant) => valueVariant.includes(queryVariant)),
    );
  });
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getPhoneNumberVariants(digits: string) {
  const variants = new Set([digits]);

  if (digits.startsWith("44") && digits.length > 4) {
    variants.add(`0${digits.slice(2)}`);
  }

  if (digits.startsWith("0") && digits.length > 4) {
    variants.add(`44${digits.slice(1)}`);
  }

  return [...variants];
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
