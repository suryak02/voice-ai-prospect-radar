import { CheckCircle2, MapPin, XCircle } from "lucide-react";
import type { Business, Ticket } from "@/lib/types";

const statusStyles: Record<Ticket["status"], string> = {
  open: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  reviewed: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  rejected: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

const statusIcons: Record<Ticket["status"], typeof CheckCircle2> = {
  open: CheckCircle2,
  reviewed: MapPin,
  rejected: XCircle,
};

type TicketQueueProps = {
  tickets: Ticket[];
  businesses: Business[];
  selectedBusinessId: string;
  onSelectTicket: (ticket: Ticket) => void;
};

export function TicketQueue({ tickets, businesses, selectedBusinessId, onSelectTicket }: TicketQueueProps) {
  const visibleTickets = tickets.filter((ticket, index, allTickets) =>
    allTickets.findIndex((candidate) => candidate.businessId === ticket.businessId) === index,
  );
  const openTickets = visibleTickets.filter((ticket) => ticket.status === "open");
  const rejectedTickets = visibleTickets.filter((ticket) => ticket.status === "rejected");

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">Human review</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Ticket queue</h2>
        </div>
        <div className="flex gap-2 text-xs font-black">
          <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-emerald-950">{openTickets.length} open</span>
          {rejectedTickets.length > 0 && <span className="rounded-full bg-rose-300 px-2.5 py-1 text-rose-950">{rejectedTickets.length} not fit</span>}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-400">
            No tickets yet. Open a review ticket from the selected prospect panel and it will appear here as a clickable card.
          </div>
        ) : (
          visibleTickets.map((ticket) => {
            const matchingBusiness = businesses.find((business) => business.id === ticket.businessId);
            const isSelected = ticket.businessId === selectedBusinessId;
            const StatusIcon = statusIcons[ticket.status];

            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onSelectTicket(ticket)}
                disabled={!matchingBusiness}
                className={`w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? "border-indigo-300/50 bg-indigo-300/12 shadow-lg shadow-indigo-950/20"
                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{ticket.businessName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ticket.status === "rejected" ? "Marked not fit" : "Opened"} {ticket.createdAt}
                    </p>
                    {!matchingBusiness && <p className="mt-2 text-xs text-amber-200">Not in the current result set.</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-950 shadow-sm">
                    {ticket.score}/9
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusStyles[ticket.status]}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {ticket.status === "rejected" ? "not fit" : ticket.status}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-400">
                    <MapPin className="h-3.5 w-3.5" />
                    Open on map
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
