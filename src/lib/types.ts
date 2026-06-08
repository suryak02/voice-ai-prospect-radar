export type BusinessCategory =
  // Healthcare & clinics
  | "dental"
  | "aesthetics"
  | "veterinary"
  | "physiotherapy"
  | "chiropractor"
  | "optometry"
  | "dermatology"
  | "podiatry"
  // Beauty & personal care
  | "medspa"
  | "hair_salon"
  | "barber"
  | "nail_salon"
  | "spa"
  // Home & trade services
  | "plumber"
  | "electrician"
  | "hvac"
  | "auto_repair"
  // Professional services
  | "legal"
  | "accountant"
  | "estate_agent"
  | "insurance"
  // Low-fit / contrast
  | "retail"
  | "restaurant"
  | "other";

export type BusinessStatus =
  | "new"
  | "needs_review"
  | "approved_for_contact"
  | "contacted"
  | "not_fit";

export type ScoreBreakdown = {
  categoryFit: number;
  callDependency: number;
  schedulingComplexity: number;
  websiteFriction: number;
  reviewPain: number;
  businessValue: number;
  confidencePenalty: number;
};

export type Business = {
  id: string;
  googlePlaceId?: string;
  name: string;
  category: BusinessCategory;
  address: string;
  borough: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  hasWebsite: boolean;
  hasOnlineBooking: boolean;
  hasVisiblePhone: boolean;
  appointmentBased: boolean;
  highValueService: boolean;
  reviewPainSignals: string[];
  voiceAiScore: number;
  scoreBreakdown: ScoreBreakdown;
  recommendedUseCase: string;
  reasoning: string;
  aiSummary?: string;
  aiAngle?: string;
  aiCategory?: string;
  aiModel?: string;
  aiDepth?: string;
  aiEnrichedAt?: string;
  status: BusinessStatus;
};

export type ScoreInput = Pick<
  Business,
  | "category"
  | "hasWebsite"
  | "hasOnlineBooking"
  | "hasVisiblePhone"
  | "appointmentBased"
  | "highValueService"
  | "reviewPainSignals"
  | "reviewCount"
>;

export type Ticket = {
  id: string;
  businessId: string;
  businessName: string;
  score: number;
  status: "open" | "contacted" | "won" | "lost";
  createdAt: string;
};
