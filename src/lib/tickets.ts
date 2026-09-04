import type { Ticket } from "./types";

export const TICKET_STATUS_VALUES = ["open", "contacted", "won", "lost"] as const;
export type TicketPipelineStatus = (typeof TICKET_STATUS_VALUES)[number];

export type TicketColumn = {
  status: TicketPipelineStatus;
  label: string;
  description: string;
  accent: string;
};

export const TICKET_COLUMNS: TicketColumn[] = [
  {
    status: "open",
    label: "Open tickets",
    description: "Qualified prospects waiting for first outreach.",
    accent: "emerald",
  },
  {
    status: "contacted",
    label: "Contacted / pending",
    description: "Outreach started; waiting on reply, call, or follow-up.",
    accent: "sky",
  },
  {
    status: "won",
    label: "Successful",
    description: "Converted, booked, or clearly positive outcome.",
    accent: "violet",
  },
  {
    status: "lost",
    label: "Unsuccessful / not fit",
    description: "Rejected, wrong fit, no response, or closed out.",
    accent: "rose",
  },
];

const TICKET_STATUS_DISPLAY_LABELS: Record<TicketPipelineStatus, string> = {
  open: "Open",
  contacted: "Contacted",
  won: "Won",
  lost: "Not fit / lost",
};

export function normalizeTicketStatus(status: string): TicketPipelineStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "reviewed") return "contacted";
  if (normalized === "rejected") return "lost";
  if ((TICKET_STATUS_VALUES as readonly string[]).includes(normalized)) return normalized as TicketPipelineStatus;
  return "open";
}

export function normalizeTicketScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(Math.max(Math.round(score), 0), 9);
}

export type TicketMetrics = {
  total: number;
  byStatus: Record<TicketPipelineStatus, number>;
  closedTotal: number;
  winRate: number;
  averageScore: number;
  highScoreOpen: number;
};

export function calculateTicketMetrics(tickets: Ticket[]): TicketMetrics {
  const byStatus: Record<TicketPipelineStatus, number> = {
    open: 0,
    contacted: 0,
    won: 0,
    lost: 0,
  };

  let scoreTotal = 0;
  let highScoreOpen = 0;

  for (const ticket of tickets) {
    const status = normalizeTicketStatus(ticket.status);
    const score = normalizeTicketScore(ticket.score);
    byStatus[status] += 1;
    scoreTotal += score;
    if (status === "open" && score >= 8) highScoreOpen += 1;
  }

  const closedTotal = byStatus.won + byStatus.lost;
  const winRate = closedTotal ? Math.round((byStatus.won / closedTotal) * 100) : 0;
  const averageScore = tickets.length ? Math.round(scoreTotal / tickets.length) : 0;

  return {
    total: tickets.length,
    byStatus,
    closedTotal,
    winRate,
    averageScore,
    highScoreOpen,
  };
}

export function getTicketColumnForStatus(status: string): TicketColumn {
  const normalized = normalizeTicketStatus(status);
  return TICKET_COLUMNS.find((column) => column.status === normalized) ?? TICKET_COLUMNS[0];
}

export function ticketStatusDisplayLabel(status: string): string {
  return TICKET_STATUS_DISPLAY_LABELS[normalizeTicketStatus(status)];
}
