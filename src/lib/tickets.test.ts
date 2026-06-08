import { describe, expect, it } from "vitest";
import { calculateTicketMetrics, normalizeTicketStatus, TICKET_COLUMNS } from "./tickets";
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
});
