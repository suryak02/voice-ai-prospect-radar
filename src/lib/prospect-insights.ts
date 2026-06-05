import { CATEGORY_META } from "./categories";
import { getScoreLabel } from "./scoring";
import type { Business } from "./types";

export function buildSpecificReasoning(business: Business): string[] {
  const copy = CATEGORY_META[business.category].copy;
  const parts: string[] = [];

  parts.push(`${business.name} scores ${business.voiceAiScore}/9 (${getScoreLabel(business.voiceAiScore).toLowerCase()}) because the public signals point to a realistic front-desk automation use case, not just a generic lead.`);
  parts.push(copy.buyer);

  if (business.hasVisiblePhone && business.phone) {
    parts.push(`A visible phone number (${business.phone}) means there is a live call path an AI receptionist could cover after hours, during staff overload, or while the team is with customers.`);
  } else if (business.hasVisiblePhone) {
    parts.push("A visible public phone number means there is a live call path an AI receptionist could cover after hours or during staff overload.");
  } else {
    parts.push("No public phone number was found, so call-dependency confidence is lower and outreach should verify whether phone enquiries matter.");
  }

  if (business.hasOnlineBooking) {
    parts.push("There are signs of online booking, so the strongest angle is not replacing booking software; it is call overflow, reminders, FAQs, and lead capture around the booking journey.");
  } else if (business.hasWebsite) {
    parts.push("A website exists, but no obvious booking signal was detected, which makes scheduling friction plausible and worth checking manually before outreach.");
  } else {
    parts.push("No clear website or booking path was found, so the opportunity may be call capture first and workflow validation second.");
  }

  if ((business.reviewCount ?? 0) >= 500) {
    parts.push(`${business.reviewCount} Google reviews is a strong demand proxy: enough customer activity that missed calls, slow replies, or repetitive FAQs could be material.`);
  } else if ((business.reviewCount ?? 0) >= 100) {
    parts.push(`${business.reviewCount} Google reviews suggests meaningful local demand, making responsiveness and appointment handling worth evaluating.`);
  } else if ((business.reviewCount ?? 0) > 0) {
    parts.push(`${business.reviewCount} Google reviews gives some confidence, but the lower review volume means a human should verify call volume before prioritising outreach.`);
  } else {
    parts.push("Review volume is unknown, so confidence depends more heavily on category fit, website/phone signals, and manual verification.");
  }

  if (business.rating !== undefined) {
    if (business.rating >= 4.7) {
      parts.push(`The ${business.rating} rating suggests the pitch should be about capturing more good demand, not fixing a reputation problem.`);
    } else if (business.rating < 4.3) {
      parts.push(`The ${business.rating} rating may indicate responsiveness or service friction, so the pitch should be careful: better intake and routing, not criticism.`);
    } else {
      parts.push(`The ${business.rating} rating is solid enough for outreach, with room to frame Voice AI as a consistency and responsiveness layer.`);
    }
  }

  return parts;
}

export function buildVoiceAiAngle(business: Business): string {
  const copy = CATEGORY_META[business.category].copy;
  return `Suggested angle: AI front desk to ${copy.frontDeskJob}. Qualify for ${copy.qualification}. Main pain hypothesis: ${copy.missedCallPain}.`;
}
