"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDot, RotateCcw, Trophy, XCircle } from "lucide-react";
import { calculateTicketMetrics, TICKET_COLUMNS, type TicketPipelineStatus } from "@/lib/tickets";
import type { Ticket } from "@/lib/types";

const columnStyles: Record<TicketPipelineStatus, string> = {
  open: "border-emerald-300/25 bg-emerald-300/[0.07]",
  contacted: "border-sky-300/25 bg-sky-300/[0.07]",
  won: "border-violet-300/25 bg-violet-300/[0.07]",
  lost: "border-rose-300/25 bg-rose-300/[0.07]",
};

const statusPills: Record<TicketPipelineStatus, string> = {
  open: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  contacted: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  won: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  lost: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

const statusIcons: Record<TicketPipelineStatus, typeof CircleDot> = {
  open: CircleDot,
  contacted: CheckCircle2,
  won: Trophy,
  lost: XCircle,
};

type TicketPipelineBoardProps = {
  initialTickets: Ticket[];
};

export function TicketPipelineBoard({ initialTickets }: TicketPipelineBoardProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [message, setMessage] = useState("");
  const metrics = useMemo(() => calculateTicketMetrics(tickets), [tickets]);

  async function updateTicketStatus(ticket: Ticket, status: TicketPipelineStatus) {
    const previousTickets = tickets;
    const nextTicket = { ...ticket, status };
    setTickets((current) => current.map((currentTicket) => (currentTicket.id === ticket.id ? nextTicket : currentTicket)));
    setMessage("");

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: ticket.businessId,
          businessName: ticket.businessName,
          score: ticket.score,
          status,
        }),
      });
      const data = (await response.json()) as { ticket?: Ticket; error?: string };
      if (!response.ok || !data.ticket) throw new Error(data.error ?? "Could not update ticket.");

      setTickets((current) => current.map((currentTicket) => (currentTicket.id === ticket.id ? data.ticket! : currentTicket)));
    } catch (error) {
      setTickets(previousTickets);
      setMessage(error instanceof Error ? error.message : "Could not update ticket.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total tickets" value={metrics.total.toString()} detail="All outreach decisions" />
        <MetricCard label="Open" value={metrics.byStatus.open.toString()} detail={`${metrics.highScoreOpen} high-score waiting`} />
        <MetricCard label="Contacted" value={metrics.byStatus.contacted.toString()} detail="Pending reply/follow-up" />
        <MetricCard label="Closed" value={metrics.closedTotal.toString()} detail={`${metrics.winRate}% win rate`} />
        <MetricCard label="Average score" value={`${metrics.averageScore}/9`} detail="Across ticketed prospects" />
      </div>

      {message && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{message}</p>}

      <div className="grid gap-4 xl:grid-cols-4">
        {TICKET_COLUMNS.map((column) => {
          const columnTickets = tickets.filter((ticket) => ticket.status === column.status);
          const StatusIcon = statusIcons[column.status];

          return (
            <section key={column.status} className={`min-h-[360px] rounded-[1.75rem] border p-4 shadow-2xl shadow-black/20 ${columnStyles[column.status]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{columnTickets.length} tickets</p>
                  <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                    <StatusIcon className="h-4 w-4 text-indigo-200" /> {column.label}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{column.description}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {columnTickets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-500">
                    No prospects in this stage yet.
                  </div>
                ) : (
                  columnTickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} onStatusChange={updateTicketStatus} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  onStatusChange,
}: {
  ticket: Ticket;
  onStatusChange: (ticket: Ticket, status: TicketPipelineStatus) => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5 text-white">{ticket.businessName}</h3>
          <p className="mt-1 text-xs text-slate-500">Updated {ticket.createdAt}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-950">{ticket.score}/9</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPills[ticket.status]}`}>{ticket.status}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {ticket.status !== "open" && (
          <button type="button" onClick={() => onStatusChange(ticket, "open")} className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/[0.06]">
            <RotateCcw className="mr-1 inline h-3.5 w-3.5" /> Reopen
          </button>
        )}
        {ticket.status === "open" && (
          <button type="button" onClick={() => onStatusChange(ticket, "contacted")} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-100 hover:bg-sky-300/15">
            Mark contacted
          </button>
        )}
        {ticket.status !== "won" && (
          <button type="button" onClick={() => onStatusChange(ticket, "won")} className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-violet-100 hover:bg-violet-300/15">
            Mark won
          </button>
        )}
        {ticket.status !== "lost" && (
          <button type="button" onClick={() => onStatusChange(ticket, "lost")} className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-rose-100 hover:bg-rose-300/15">
            Mark lost
          </button>
        )}
      </div>
    </article>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function PipelineBackLink() {
  return (
    <Link href="/" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
      <ArrowLeft className="h-4 w-4" /> Back to prospect map
    </Link>
  );
}
