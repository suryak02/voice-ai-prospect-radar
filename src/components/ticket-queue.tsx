import type { Ticket } from "@/lib/types";

type TicketQueueProps = {
  tickets: Ticket[];
};

export function TicketQueue({ tickets }: TicketQueueProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">Human review</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Ticket queue</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-950">{tickets.length}</span>
      </div>

      <div className="mt-5 space-y-3">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-400">
            No tickets yet. Click a high-scoring marker and open a review ticket for a human to contact or investigate.
          </div>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{ticket.businessName}</p>
                  <p className="mt-1 text-xs text-slate-500">Opened {ticket.createdAt}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-950 shadow-sm">
                  {ticket.score}/9
                </span>
              </div>
              <p className="mt-3 w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold capitalize text-emerald-100">
                {ticket.status}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
