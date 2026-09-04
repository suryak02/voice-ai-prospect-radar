import { describe, expect, it } from "vitest";
import {
  calculateTicketMetrics,
  getTicketColumnForStatus,
  normalizeTicketScore,
  normalizeTicketStatus,
  ticketStatusDisplayLabel,
  TICKET_COLUMNS,
} from "./tickets";
import type { Ticket } from "./types";

function ticket(status: Ticket["status"], score = 7): Ticket {
  return {
    id: `ticket-${status}-${score}`,
    businessId: `business-${status}-${score}`,
    businessName: `${status} business`,
    score,
    status,
    createdAt: "08 Jun, 10:00",
  };
}

describe("ticket pipeline helpers", () => {
  it("defines the outreach pipeline columns in display order", () => {
    expect(TICKET_COLUMNS.map((column) => column.status)).toEqual(["open", "contacted", "won", "lost"]);
  });

  it("normalizes legacy ticket statuses into the current pipeline", () => {
    expect(normalizeTicketStatus("reviewed")).toBe("contacted");
    expect(normalizeTicketStatus("rejected")).toBe("lost");
    expect(normalizeTicketStatus("open")).toBe("open");
    expect(normalizeTicketStatus(" Contacted ")).toBe("contacted");
    expect(normalizeTicketStatus("WON")).toBe("won");
  });

  it("normalizes malformed ticket scores before aggregating metrics", () => {
    expect(normalizeTicketScore(Number.NaN)).toBe(0);
    expect(normalizeTicketScore(-2)).toBe(0);
    expect(normalizeTicketScore(7.6)).toBe(8);
    expect(normalizeTicketScore(12)).toBe(9);
  });

  it("looks up display metadata after normalizing ticket statuses", () => {
    expect(getTicketColumnForStatus("reviewed").status).toBe("contacted");
    expect(getTicketColumnForStatus("rejected").accent).toBe("rose");
    expect(getTicketColumnForStatus("unknown").status).toBe("open");
  });

  it("returns concise labels for ticket cards and confirmations", () => {
    expect(ticketStatusDisplayLabel("open")).toBe("Open");
    expect(ticketStatusDisplayLabel("contacted")).toBe("Contacted");
    expect(ticketStatusDisplayLabel("won")).toBe("Won");
    expect(ticketStatusDisplayLabel("rejected")).toBe("Not fit / lost");
  });

  it("calculates pipeline counts and win rate", () => {
    const metrics = calculateTicketMetrics([
      ticket("open", 9),
      ticket("contacted", 8),
      ticket("won", 9),
      ticket("lost", 5),
    ]);

    expect(metrics.total).toBe(4);
    expect(metrics.byStatus).toEqual({ open: 1, contacted: 1, won: 1, lost: 1 });
    expect(metrics.closedTotal).toBe(2);
    expect(metrics.winRate).toBe(50);
    expect(metrics.averageScore).toBe(8);
    expect(metrics.highScoreOpen).toBe(1);
  });

  it("keeps ticket metrics finite when stored scores are malformed", () => {
    const metrics = calculateTicketMetrics([
      ticket("open", Number.NaN),
      ticket("open", 8.7),
      ticket("won", 12),
      ticket("lost", -4),
    ]);

    expect(metrics.averageScore).toBe(5);
    expect(metrics.highScoreOpen).toBe(1);
    expect(metrics.winRate).toBe(50);
  });
});
