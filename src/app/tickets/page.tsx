import { TicketPipelineBoard, PipelineBackLink } from "@/components/ticket-pipeline-board";
import { ThemeToggle } from "@/components/theme-provider";
import { getTickets } from "@/lib/data/businesses";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const tickets = await getTickets();

  return (
    <main className="min-h-screen text-slate-100">
      <section className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-100">
                Human outreach pipeline
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                Track prospect tickets from review to outcome.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg">
                Move prospects through open, contacted, successful, and unsuccessful stages so the demo shows more than a static shortlist: it shows an outreach workflow and basic conversion signals.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <PipelineBackLink />
            </div>
          </div>
        </header>

        <TicketPipelineBoard initialTickets={tickets} />
      </section>
    </main>
  );
}
