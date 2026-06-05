import type { BusinessCategory } from "./types";

/**
 * Single source of truth for every business category the product understands.
 *
 * Previously the category search terms, appointment/value flags, use-case copy,
 * inference keywords and scoring fit-tiers were duplicated across
 * `google-places.ts`, `scripts/ingest-google-places.ts`, `mock-businesses.ts`,
 * `prospect-insights.ts` and `scoring.ts`. Adding verticals meant editing all of
 * them in lockstep. Everything now derives from `CATEGORY_META` below.
 */

export type CategoryFitTier = "high" | "mid" | "low";

export type CategoryGroup =
  | "Healthcare & clinics"
  | "Beauty & personal care"
  | "Home & trade services"
  | "Professional services"
  | "Other";

export type CategoryCopy = {
  buyer: string;
  frontDeskJob: string;
  missedCallPain: string;
  qualification: string;
};

export type CategoryMeta = {
  value: BusinessCategory;
  label: string;
  group: CategoryGroup;
  /** Query fragment used as `${searchTerm} in ${area}` for Google Places text search. */
  searchTerm: string;
  /** Lowercased substrings matched against place types + name to classify a result. */
  inferKeywords: string[];
  appointmentBased: boolean;
  highValueService: boolean;
  fitTier: CategoryFitTier;
  /** Recommended Voice AI use case shown on the prospect card. */
  useCase: string;
  copy: CategoryCopy;
};

export const CATEGORY_META: Record<BusinessCategory, CategoryMeta> = {
  // ───────────────────────── Healthcare & clinics ─────────────────────────
  dental: {
    value: "dental",
    label: "Dental",
    group: "Healthcare & clinics",
    searchTerm: "dentist or dental clinic",
    inferKeywords: ["dental", "dentist", "dent", "orthodont", "endodont"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI receptionist for appointment booking, rescheduling, reminders, new patient queries, and after-hours missed calls.",
    copy: {
      buyer: "Dental practices usually lose money when new-patient calls, emergency enquiries, or hygiene bookings are missed.",
      frontDeskJob: "book consultations, route emergencies, answer treatment questions, and send appointment reminders",
      missedCallPain: "missed calls can become lost patient registrations or delayed treatment bookings",
      qualification: "new patient, emergency, private treatment, NHS availability, and preferred appointment time",
    },
  },
  aesthetics: {
    value: "aesthetics",
    label: "Aesthetics",
    group: "Healthcare & clinics",
    searchTerm: "aesthetic clinic or skin clinic",
    inferKeywords: ["aesthetic", "aesthetics", "skin clinic", "laser clinic", "botox", "cosmetic clinic", "skin"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI front desk for consultations, treatment FAQs, appointment deposits, reminders, and lead qualification.",
    copy: {
      buyer: "Aesthetic clinics depend on fast lead response because treatment enquiries are often high-intent and comparison-shopped.",
      frontDeskJob: "qualify treatment interest, capture consultation requests, answer pricing/process FAQs, and chase deposits or reminders",
      missedCallPain: "slow response can lose a Botox, laser, skin, or consultation lead to a nearby clinic",
      qualification: "treatment type, budget/timeline, previous treatment, contraindication flags, and preferred clinician/time",
    },
  },
  veterinary: {
    value: "veterinary",
    label: "Veterinary",
    group: "Healthcare & clinics",
    searchTerm: "veterinary clinic",
    inferKeywords: ["veterinar", "vets", "vet", "animal hospital", "animal"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI call handler for triage, appointment booking, reminders, repeat medication requests, and emergency routing.",
    copy: {
      buyer: "Vet clinics have urgent and routine call flows, so triage and routing matter more than simple FAQ handling.",
      frontDeskJob: "triage urgency, book routine visits, route emergencies, handle repeat medication requests, and send reminders",
      missedCallPain: "missed or delayed calls create owner anxiety and can push clients to another local vet",
      qualification: "pet type, symptoms/urgency, registration status, repeat prescription need, and appointment window",
    },
  },
  physiotherapy: {
    value: "physiotherapy",
    label: "Physiotherapy",
    group: "Healthcare & clinics",
    searchTerm: "physiotherapy clinic",
    inferKeywords: ["physiotherap", "physio", "sports injury", "rehabilitation"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI front desk for assessment bookings, rebooking treatment blocks, reminders, and self-pay/insurance enquiry capture.",
    copy: {
      buyer: "Physio clinics rely on repeat appointment blocks, so missed booking and rebooking calls directly cut revenue.",
      frontDeskJob: "book assessments, rebook treatment blocks, answer self-pay vs insurance questions, and send reminders",
      missedCallPain: "an unanswered call can lose a treatment course worth many sessions, not just one visit",
      qualification: "injury/condition, self-pay or insurer, referral status, urgency, and preferred clinician/time",
    },
  },
  chiropractor: {
    value: "chiropractor",
    label: "Chiropractor",
    group: "Healthcare & clinics",
    searchTerm: "chiropractor clinic",
    inferKeywords: ["chiropract", "chiro", "spinal clinic"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI receptionist for new-patient bookings, rebooking adjustment plans, reminders, and after-hours call capture.",
    copy: {
      buyer: "Chiropractic clinics run on recurring adjustment plans, so booking continuity is the core revenue driver.",
      frontDeskJob: "book new-patient assessments, rebook adjustment plans, answer pricing FAQs, and send reminders",
      missedCallPain: "a missed call can interrupt a care plan and push a patient to a competing clinic",
      qualification: "complaint, new or returning patient, plan stage, urgency, and preferred appointment time",
    },
  },
  optometry: {
    value: "optometry",
    label: "Opticians / Optometry",
    group: "Healthcare & clinics",
    searchTerm: "opticians or optometrist",
    inferKeywords: ["optometr", "optician", "opticians", "eye care", "eyewear", "glasses"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI front desk for eye-test bookings, recalls, frame/collection queries, and reminders.",
    copy: {
      buyer: "Opticians depend on eye-test bookings and recalls, and dispensing revenue follows the appointment.",
      frontDeskJob: "book eye tests, manage recalls, answer collection/repair queries, and send reminders",
      missedCallPain: "a missed recall or booking call can lose both the test and the spectacle sale behind it",
      qualification: "test type, NHS or private, recall due, collection/repair need, and preferred time",
    },
  },
  dermatology: {
    value: "dermatology",
    label: "Dermatology",
    group: "Healthcare & clinics",
    searchTerm: "dermatology clinic",
    inferKeywords: ["dermatolog", "dermatology", "skin specialist", "mole clinic"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI front desk for consultation bookings, treatment FAQs, deposits, and lead qualification.",
    copy: {
      buyer: "Dermatology clinics handle high-value private consultations where slow response loses comparison-shopped leads.",
      frontDeskJob: "book consultations, answer procedure FAQs, capture deposits, and qualify private enquiries",
      missedCallPain: "a missed enquiry can lose a high-value private consultation to a nearby clinic",
      qualification: "concern/condition, private or referral, urgency, budget/timeline, and preferred clinician/time",
    },
  },
  podiatry: {
    value: "podiatry",
    label: "Podiatry / Chiropody",
    group: "Healthcare & clinics",
    searchTerm: "podiatrist or chiropodist",
    inferKeywords: ["podiat", "chiropod", "foot clinic", "foot care"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI receptionist for appointment booking, routine foot-care recalls, reminders, and call capture.",
    copy: {
      buyer: "Podiatry clinics run on routine recurring foot-care appointments, so booking continuity drives revenue.",
      frontDeskJob: "book assessments, manage routine recalls, answer treatment FAQs, and send reminders",
      missedCallPain: "a missed booking or recall call interrupts routine care and revenue",
      qualification: "complaint, new or returning patient, routine vs urgent, and preferred appointment time",
    },
  },

  // ───────────────────────── Beauty & personal care ─────────────────────────
  medspa: {
    value: "medspa",
    label: "Medical spa",
    group: "Beauty & personal care",
    searchTerm: "medical spa or med spa",
    inferKeywords: ["medical spa", "med spa", "medspa", "medical aesthetic", "wellness clinic"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "high",
    useCase:
      "AI front desk for treatment consultations, pricing FAQs, deposits, reminders, and lead qualification.",
    copy: {
      buyer: "Med spas sell high-ticket treatment packages where fast, qualified lead handling drives bookings.",
      frontDeskJob: "qualify treatment interest, book consultations, answer pricing FAQs, and capture deposits",
      missedCallPain: "a slow or missed reply can lose a high-value package to a competing clinic",
      qualification: "treatment type, budget, previous treatment, contraindications, and preferred time",
    },
  },
  hair_salon: {
    value: "hair_salon",
    label: "Hair salon",
    group: "Beauty & personal care",
    searchTerm: "hair salon",
    inferKeywords: ["hair salon", "hairdress", "hair studio", "salon"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI booking assistant for appointments, rescheduling, reminders, and overflow/after-hours calls.",
    copy: {
      buyer: "Hair salons lose chair time when booking calls go unanswered while stylists are with clients.",
      frontDeskJob: "book and reschedule appointments, answer service/pricing FAQs, and send reminders",
      missedCallPain: "an unanswered call during a busy chair is a lost booking and lost chair time",
      qualification: "service wanted, stylist preference, new or returning, and preferred time",
    },
  },
  barber: {
    value: "barber",
    label: "Barber",
    group: "Beauty & personal care",
    searchTerm: "barber shop",
    inferKeywords: ["barbershop", "barber"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI booking assistant for booked cuts, reminders, and missed-call capture during busy periods.",
    copy: {
      buyer: "Barbers running on bookings lose slots when calls go unanswered mid-cut.",
      frontDeskJob: "book appointments, answer hours/pricing questions, and send reminders",
      missedCallPain: "a missed call during a busy chair is a directly lost booking",
      qualification: "service wanted, barber preference, and preferred time",
    },
  },
  nail_salon: {
    value: "nail_salon",
    label: "Nail salon",
    group: "Beauty & personal care",
    searchTerm: "nail salon",
    inferKeywords: ["nail salon", "nail bar", "nails", "nail"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI booking assistant for appointments, reminders, service/pricing FAQs, and overflow calls.",
    copy: {
      buyer: "Nail salons lose bookings when calls go unanswered while technicians are with clients.",
      frontDeskJob: "book appointments, answer service/pricing FAQs, and send reminders",
      missedCallPain: "a missed call during service is a lost appointment",
      qualification: "service wanted, technician preference, and preferred time",
    },
  },
  spa: {
    value: "spa",
    label: "Spa & wellness",
    group: "Beauty & personal care",
    searchTerm: "day spa",
    inferKeywords: ["day spa", "spa", "massage", "sauna", "wellness"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI front desk for treatment bookings, gift-voucher queries, reminders, and overflow calls.",
    copy: {
      buyer: "Spas lose bookings and voucher sales when enquiry calls go unanswered.",
      frontDeskJob: "book treatments, answer package/voucher questions, and send reminders",
      missedCallPain: "a missed enquiry can lose a multi-treatment or voucher booking",
      qualification: "treatment/package, party size, gift voucher need, and preferred date/time",
    },
  },

  // ───────────────────────── Home & trade services ─────────────────────────
  plumber: {
    value: "plumber",
    label: "Plumber",
    group: "Home & trade services",
    searchTerm: "plumber",
    inferKeywords: ["plumbing", "plumber", "plumb", "drainage"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI call handler to capture job enquiries, triage urgency/emergencies, book visits, and stop missed calls while on jobs.",
    copy: {
      buyer: "Plumbers miss new-job calls constantly because they are on-site and can't answer the phone.",
      frontDeskJob: "capture job details, triage emergencies, book visits, and take callback details",
      missedCallPain: "every missed call while on a job is a job that goes to the next plumber who answers",
      qualification: "job type, emergency vs routine, location/access, and preferred visit window",
    },
  },
  electrician: {
    value: "electrician",
    label: "Electrician",
    group: "Home & trade services",
    searchTerm: "electrician",
    inferKeywords: ["electrician", "electrical", "electric"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI call handler to capture enquiries, triage urgency, book visits, and cover calls while on site.",
    copy: {
      buyer: "Electricians lose new work when on-site jobs stop them answering enquiry calls.",
      frontDeskJob: "capture job details, triage urgency, book visits, and take callback details",
      missedCallPain: "a missed enquiry while on a job is lost work to a competitor who picks up",
      qualification: "job type, emergency vs routine, location/access, and preferred visit window",
    },
  },
  hvac: {
    value: "hvac",
    label: "Heating / HVAC",
    group: "Home & trade services",
    searchTerm: "heating and air conditioning engineer",
    inferKeywords: ["hvac", "air conditioning", "heating engineer", "boiler", "gas engineer", "heating"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI call handler for service/repair enquiries, urgency triage, booking, and missed-call capture.",
    copy: {
      buyer: "Heating and HVAC engineers face seasonal call spikes and lose jobs when calls go unanswered on-site.",
      frontDeskJob: "capture service/repair details, triage breakdowns, book visits, and take callbacks",
      missedCallPain: "a missed breakdown call in peak season is lost emergency revenue",
      qualification: "system type, breakdown vs service, location/access, and preferred visit window",
    },
  },
  auto_repair: {
    value: "auto_repair",
    label: "Auto repair / Garage",
    group: "Home & trade services",
    searchTerm: "car repair garage or MOT centre",
    inferKeywords: ["auto repair", "car repair", "garage", "mot", "mechanic", "car service", "tyre", "bodyshop"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI front desk for booking MOTs/services/repairs, quote callbacks, reminders, and overflow calls.",
    copy: {
      buyer: "Garages lose bookings when the phone rings while staff are under a car or with a customer.",
      frontDeskJob: "book MOTs/services/repairs, answer quote/availability questions, and send reminders",
      missedCallPain: "a missed call is a lost MOT or service slot that fills a competitor's diary",
      qualification: "vehicle, job type (MOT/service/repair), urgency, and preferred drop-off time",
    },
  },

  // ───────────────────────── Professional services ─────────────────────────
  legal: {
    value: "legal",
    label: "Legal / Solicitors",
    group: "Professional services",
    searchTerm: "solicitor or legal practice",
    inferKeywords: ["solicitor", "law firm", "legal", "law", "barrister", "conveyanc"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "mid",
    useCase:
      "Careful intake assistant for basic routing and callback capture, not legal advice automation.",
    copy: {
      buyer: "Legal firms need structured intake and callback capture, but automation must stay away from legal advice.",
      frontDeskJob: "capture matter type, conflict-safe contact details, urgency, and route callbacks to the right fee earner",
      missedCallPain: "missed calls can lose a qualified enquiry before a solicitor has a chance to assess it",
      qualification: "matter type, urgency, location, budget/legal-aid fit, and required callback window",
    },
  },
  accountant: {
    value: "accountant",
    label: "Accountant",
    group: "Professional services",
    searchTerm: "accountant or accounting firm",
    inferKeywords: ["accountant", "accounting", "bookkeep", "tax adviser", "chartered account"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "mid",
    useCase:
      "AI front desk for new-client enquiries, callback capture, document/deadline FAQs, and appointment booking.",
    copy: {
      buyer: "Accountancy firms win recurring clients, so a missed new-client enquiry is a high lifetime-value loss.",
      frontDeskJob: "capture new-client enquiries, answer service/deadline FAQs, and book consultations",
      missedCallPain: "a missed enquiry can lose a recurring client relationship, not just one job",
      qualification: "service needed, business or personal, deadline/urgency, and preferred callback time",
    },
  },
  estate_agent: {
    value: "estate_agent",
    label: "Estate agent",
    group: "Professional services",
    searchTerm: "estate agent",
    inferKeywords: ["estate agent", "estate agents", "lettings", "letting agent", "property", "realtor"],
    appointmentBased: true,
    highValueService: true,
    fitTier: "mid",
    useCase:
      "AI front desk to capture buyer/tenant enquiries, book viewings, qualify intent, and cover missed calls.",
    copy: {
      buyer: "Estate and letting agents live on viewing volume, so missed buyer/tenant calls are missed deals.",
      frontDeskJob: "capture buyer/tenant enquiries, qualify intent, book viewings, and take callbacks",
      missedCallPain: "a missed enquiry on a hot listing is a lost viewing and potential sale or let",
      qualification: "buy or rent, budget, property/area interest, timeline, and preferred viewing time",
    },
  },
  insurance: {
    value: "insurance",
    label: "Insurance broker",
    group: "Professional services",
    searchTerm: "insurance broker",
    inferKeywords: ["insurance broker", "insurance", "broker"],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "AI front desk to capture quote enquiries, qualify needs, and route callbacks to advisers.",
    copy: {
      buyer: "Insurance brokers compete on quote speed, so a missed enquiry is a quote a competitor writes instead.",
      frontDeskJob: "capture quote enquiries, qualify cover needs, and route callbacks to advisers",
      missedCallPain: "a missed quote enquiry is lost commission to a faster broker",
      qualification: "cover type, business or personal, renewal date, and preferred callback time",
    },
  },

  // ───────────────────────── Low-fit / contrast ─────────────────────────
  retail: {
    value: "retail",
    label: "Retail (contrast)",
    group: "Other",
    searchTerm: "local retail shop",
    inferKeywords: ["retail", "boutique", "store", "shop"],
    appointmentBased: false,
    highValueService: false,
    fitTier: "low",
    useCase:
      "Low-priority customer service assistant; likely weaker fit unless call volume is proven.",
    copy: {
      buyer: "Retail is usually weaker for Voice AI unless the store has frequent product, repair, delivery, or appointment enquiries.",
      frontDeskJob: "answer stock/location questions, capture callbacks, and route service or repair enquiries",
      missedCallPain: "call automation is only compelling if phone volume is proven",
      qualification: "enquiry type, product/service need, location, and urgency",
    },
  },
  restaurant: {
    value: "restaurant",
    label: "Restaurant (contrast)",
    group: "Other",
    searchTerm: "restaurant",
    inferKeywords: ["restaurant", "cafe", "coffee", "bistro", "eatery", "bar"],
    appointmentBased: false,
    highValueService: false,
    fitTier: "low",
    useCase:
      "Booking and FAQ assistant, but often weaker fit if existing reservation tooling handles demand.",
    copy: {
      buyer: "Restaurants can benefit from booking and FAQ automation, but existing reservation tools often reduce urgency.",
      frontDeskJob: "handle booking questions, opening hours, dietary FAQs, party-size capture, and overflow calls",
      missedCallPain: "missed calls mostly matter during peak service or for larger bookings",
      qualification: "party size, date/time, dietary needs, occasion, and deposit/private-room requirements",
    },
  },
  other: {
    value: "other",
    label: "Other appointment-based",
    group: "Other",
    searchTerm: "appointment based local business",
    inferKeywords: [],
    appointmentBased: true,
    highValueService: false,
    fitTier: "mid",
    useCase:
      "General call capture and appointment routing if public signals justify human review.",
    copy: {
      buyer: "This business needs manual validation because the public category is less specific, but the call path can still be useful.",
      frontDeskJob: "capture inbound enquiries, qualify intent, answer FAQs, and route callbacks",
      missedCallPain: "missed calls may still indicate lost demand if appointments or high-value enquiries are involved",
      qualification: "service needed, urgency, location, budget, and preferred callback window",
    },
  },
};

/** Every category value, in display order. */
export const CATEGORY_VALUES = Object.keys(CATEGORY_META) as BusinessCategory[];

/** Tuple form for `z.enum(...)` (validates membership at the API boundary). */
export const CATEGORY_ENUM_VALUES = CATEGORY_VALUES as [BusinessCategory, ...BusinessCategory[]];

export const CATEGORY_GROUP_ORDER: CategoryGroup[] = [
  "Healthcare & clinics",
  "Beauty & personal care",
  "Home & trade services",
  "Professional services",
  "Other",
];

/** Categories grouped for `<optgroup>` rendering in the dashboard dropdowns. */
export function getCategoryOptionGroups(): { group: CategoryGroup; options: { value: BusinessCategory; label: string }[] }[] {
  return CATEGORY_GROUP_ORDER.map((group) => ({
    group,
    options: CATEGORY_VALUES.filter((value) => CATEGORY_META[value].group === group).map((value) => ({
      value,
      label: CATEGORY_META[value].label,
    })),
  })).filter((entry) => entry.options.length > 0);
}

/** Google Places text-query fragment for a category. */
export function categorySearchTerm(category: BusinessCategory): string {
  return CATEGORY_META[category].searchTerm;
}

/**
 * Classify a Google place from its `types` + name + (optional) query text.
 * Uses a longest-keyword-wins heuristic so specific categories (e.g. "med spa")
 * beat generic ones (e.g. "spa") regardless of declaration order.
 */
export function inferCategoryFromText(text: string, fallback: BusinessCategory): BusinessCategory {
  const haystack = text.toLowerCase();
  let best: { category: BusinessCategory; length: number } | null = null;

  for (const meta of Object.values(CATEGORY_META)) {
    for (const keyword of meta.inferKeywords) {
      if (haystack.includes(keyword) && (!best || keyword.length > best.length)) {
        best = { category: meta.value, length: keyword.length };
      }
    }
  }

  return best?.category ?? fallback;
}
