"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, CircleDot, ExternalLink, GripVertical, MapPin, Phone, RotateCcw, Sparkles, Star, Trophy, X, XCircle } from "lucide-react";
import { getCategoryLabel } from "@/lib/categories";
import { readJsonResponse } from "@/lib/http-json";
import { calculateTicketMetrics, TICKET_COLUMNS, TICKET_STATUS_VALUES, ticketStatusDisplayLabel, type TicketPipelineStatus } from "@/lib/tickets";
import type { Business, Ticket } from "@/lib/types";

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

const CONFIRMATION_SESSION_KEY = "voice-ai-prospect-map:ticket-confirmation-dismissed";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type TicketPipelineBoardProps = {
  initialTickets: Ticket[];
  initialBusinesses: Business[];
};

type PendingStatusChange = {
  ticket: Ticket;
  status: TicketPipelineStatus;
  source: "button" | "drag";
};

type PointerDragState = {
  ticketId: string;
  startX: number;
  startY: number;
  isActive: boolean;
};

const POINTER_DRAG_THRESHOLD_PX = 8;

function confirmationDismissedForSession() {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(CONFIRMATION_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeToConfirmationDismissal() {
  return () => undefined;
}

function confirmationDismissedOnServer() {
  return false;
}

function isTicketPipelineStatus(value: string | null): value is TicketPipelineStatus {
  return Boolean(value && (TICKET_STATUS_VALUES as readonly string[]).includes(value));
}

function statusFromPoint(clientX: number, clientY: number): TicketPipelineStatus | null {
  const target = document.elementFromPoint(clientX, clientY);
  const dropTarget = target?.closest<HTMLElement>("[data-ticket-status]");
  const status = dropTarget?.dataset.ticketStatus ?? null;
  return isTicketPipelineStatus(status) ? status : null;
}

function isFocusableElement(element: HTMLElement) {
  return element.getAttribute("aria-hidden") !== "true" && Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function useDialogFocusTrap<T extends HTMLElement>(onClose: () => void) {
  const dialogRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dialogElement = dialog;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusableElements = () => Array.from(dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusableElement);
    const firstFocusable = getFocusableElements()[0];
    (firstFocusable ?? dialogElement).focus({ preventScroll: true });

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogElement.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!dialogElement.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  return dialogRef;
}

export function TicketPipelineBoard({ initialTickets, initialBusinesses }: TicketPipelineBoardProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [message, setMessage] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingStatusChange | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [confirmationPreference, setConfirmationPreference] = useState<boolean | null>(null);
  const [rememberDismissal, setRememberDismissal] = useState(false);
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [pointerDrag, setPointerDrag] = useState<PointerDragState | null>(null);
  const [activeDropStatus, setActiveDropStatus] = useState<TicketPipelineStatus | null>(null);
  const suppressCardClickRef = useRef(false);
  const statusRequestIdsRef = useRef(new Map<string, number>());
  const metrics = useMemo(() => calculateTicketMetrics(tickets), [tickets]);
  const businessById = useMemo(() => new Map(initialBusinesses.map((business) => [business.id, business])), [initialBusinesses]);
  const selectedTicket = selectedBusiness ? tickets.find((ticket) => ticket.businessId === selectedBusiness.id) : undefined;
  const storedDismissConfirmations = useSyncExternalStore(
    subscribeToConfirmationDismissal,
    confirmationDismissedForSession,
    confirmationDismissedOnServer,
  );
  const dismissConfirmations = confirmationPreference ?? storedDismissConfirmations;

  const updateTicketStatus = useCallback(async (ticket: Ticket, status: TicketPipelineStatus) => {
    if (ticket.status === status) return;

    const previousTicket = tickets.find((currentTicket) => currentTicket.id === ticket.id) ?? ticket;
    const nextTicket = { ...ticket, status };
    const requestId = (statusRequestIdsRef.current.get(ticket.id) ?? 0) + 1;
    statusRequestIdsRef.current.set(ticket.id, requestId);
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
      const data = await readJsonResponse<{ ticket?: Ticket; error?: string }>(response);
      if (!data.ticket) throw new Error(data.error ?? "Could not update ticket.");

      if (statusRequestIdsRef.current.get(ticket.id) !== requestId) return;
      setTickets((current) => current.map((currentTicket) => (currentTicket.id === ticket.id ? data.ticket! : currentTicket)));
    } catch (error) {
      if (statusRequestIdsRef.current.get(ticket.id) === requestId) {
        setTickets((current) => current.map((currentTicket) => (currentTicket.id === ticket.id ? previousTicket : currentTicket)));
      }
      setMessage(error instanceof Error ? error.message : "Could not update ticket.");
    }
  }, [tickets]);

  const requestStatusChange = useCallback((ticket: Ticket, status: TicketPipelineStatus, source: PendingStatusChange["source"]) => {
    if (ticket.status === status) return;
    if (dismissConfirmations) {
      void updateTicketStatus(ticket, status);
      return;
    }
    setRememberDismissal(false);
    setPendingChange({ ticket, status, source });
  }, [dismissConfirmations, updateTicketStatus]);

  useEffect(() => {
    if (!pointerDrag) return;
    const currentDrag = pointerDrag;

    function finishDrag(event: globalThis.PointerEvent) {
      const ticket = tickets.find((candidate) => candidate.id === currentDrag.ticketId);
      const status = statusFromPoint(event.clientX, event.clientY);
      const distance = Math.hypot(event.clientX - currentDrag.startX, event.clientY - currentDrag.startY);
      const hasDragged = currentDrag.isActive || distance >= POINTER_DRAG_THRESHOLD_PX;
      setDraggedTicketId(null);
      setPointerDrag(null);
      setActiveDropStatus(null);
      if (hasDragged && ticket && status && ticket.status !== status) {
        suppressCardClickRef.current = true;
        window.setTimeout(() => {
          suppressCardClickRef.current = false;
        }, 0);
        requestStatusChange(ticket, status, "drag");
      }
    }

    function trackDrag(event: globalThis.PointerEvent) {
      const distance = Math.hypot(event.clientX - currentDrag.startX, event.clientY - currentDrag.startY);
      if (distance < POINTER_DRAG_THRESHOLD_PX) return;
      if (!currentDrag.isActive) {
        setPointerDrag((currentDrag) => (currentDrag ? { ...currentDrag, isActive: true } : currentDrag));
      }
      setActiveDropStatus(statusFromPoint(event.clientX, event.clientY));
    }

    window.addEventListener("pointermove", trackDrag);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });

    return () => {
      window.removeEventListener("pointermove", trackDrag);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [pointerDrag, requestStatusChange, tickets]);

  function confirmStatusChange() {
    if (!pendingChange) return;
    if (rememberDismissal) {
      try {
        sessionStorage.setItem(CONFIRMATION_SESSION_KEY, "true");
      } catch {
        // Keep the one-time UI state even if session storage is unavailable.
      }
      setConfirmationPreference(true);
    }
    void updateTicketStatus(pendingChange.ticket, pendingChange.status);
    setPendingChange(null);
    setRememberDismissal(false);
  }

  function restoreConfirmations() {
    try {
      sessionStorage.removeItem(CONFIRMATION_SESSION_KEY);
    } catch {
      // ignore storage errors
    }
    setConfirmationPreference(false);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, ticket: Ticket) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ticket.id);
    setDraggedTicketId(ticket.id);
  }

  function handlePointerDragStart(event: PointerEvent<HTMLElement>, ticket: Ticket) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggedTicketId(ticket.id);
    setPointerDrag({
      ticketId: ticket.id,
      startX: event.clientX,
      startY: event.clientY,
      isActive: false,
    });
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TicketPipelineStatus) {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("text/plain") || draggedTicketId;
    const ticket = tickets.find((candidate) => candidate.id === ticketId);
    setDraggedTicketId(null);
    setPointerDrag(null);
    setActiveDropStatus(null);
    if (!ticket || ticket.status === status) return;
    suppressCardClickRef.current = true;
    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
    requestStatusChange(ticket, status, "drag");
  }

  function openBusinessContext(ticket: Ticket) {
    if (suppressCardClickRef.current) return;

    const business = businessById.get(ticket.businessId);
    if (!business) {
      setMessage(`Business details are not available for ${ticket.businessName} yet.`);
      return;
    }

    setMessage("");
    setSelectedBusiness(business);
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

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-white">
                {dismissConfirmations ? "Status confirmations are dismissed for this session." : "Status changes ask for confirmation."}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Drag cards between stages or use the status buttons. Confirmation prompts can be dismissed for the rest of this browser session.
              </p>
            </div>
          </div>
          {dismissConfirmations && (
            <button
              type="button"
              onClick={restoreConfirmations}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
            >
              Restore confirmations
            </button>
          )}
        </div>
      </section>

      {message && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{message}</p>}

      <div className="grid gap-4 xl:grid-cols-4">
        {TICKET_COLUMNS.map((column) => {
          const columnTickets = tickets.filter((ticket) => ticket.status === column.status);
          const StatusIcon = statusIcons[column.status];
          const isActiveDropTarget = activeDropStatus === column.status && columnTickets.every((ticket) => ticket.id !== draggedTicketId);

          return (
            <section
              key={column.status}
              data-ticket-status={column.status}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={() => setActiveDropStatus(column.status)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveDropStatus(null);
              }}
              onDrop={(event) => handleDrop(event, column.status)}
              className={`min-h-[360px] rounded-[1.75rem] border p-4 shadow-2xl shadow-black/20 transition ${columnStyles[column.status]} ${
                isActiveDropTarget ? "scale-[1.01] ring-2 ring-white/40" : ""
              }`}
            >
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
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      isDragging={draggedTicketId === ticket.id}
                      onDragStart={handleDragStart}
                      onPointerDragStart={handlePointerDragStart}
                      onDragEnd={() => {
                        setDraggedTicketId(null);
                        setPointerDrag(null);
                        setActiveDropStatus(null);
                      }}
                      onOpenBusiness={openBusinessContext}
                      onStatusChange={(nextStatus) => requestStatusChange(ticket, nextStatus, "button")}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {pendingChange && (
        <ConfirmationDialog
          change={pendingChange}
          rememberDismissal={rememberDismissal}
          onRememberDismissal={setRememberDismissal}
          onCancel={() => {
            setPendingChange(null);
            setRememberDismissal(false);
          }}
          onConfirm={confirmStatusChange}
        />
      )}

      {selectedBusiness && (
        <BusinessContextDialog
          business={selectedBusiness}
          ticket={selectedTicket}
          onClose={() => setSelectedBusiness(null)}
        />
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  isDragging,
  onDragStart,
  onDragEnd,
  onPointerDragStart,
  onOpenBusiness,
  onStatusChange,
}: {
  ticket: Ticket;
  isDragging: boolean;
  onDragStart: (event: DragEvent<HTMLElement>, ticket: Ticket) => void;
  onDragEnd: () => void;
  onPointerDragStart: (event: PointerEvent<HTMLElement>, ticket: Ticket) => void;
  onOpenBusiness: (ticket: Ticket) => void;
  onStatusChange: (status: TicketPipelineStatus) => void;
}) {
  function handleCardClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, label, [data-ticket-drag-handle]")) return;
    onOpenBusiness(ticket);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onOpenBusiness(ticket);
  }

  function handleStatusClick(event: MouseEvent<HTMLButtonElement>, status: TicketPipelineStatus) {
    event.stopPropagation();
    onStatusChange(status);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Open context for ${ticket.businessName}`}
      data-ticket-id={ticket.id}
      data-ticket-status={ticket.status}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={`cursor-pointer select-none rounded-2xl border border-white/10 bg-black/30 p-4 shadow-lg shadow-black/20 transition focus:outline-none focus:ring-2 focus:ring-sky-300/60 active:cursor-grabbing ${
        isDragging ? "scale-[0.98] opacity-55 ring-2 ring-indigo-200/40" : "hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span
              data-ticket-drag-handle
              draggable
              title="Drag ticket"
              onClick={(event) => event.stopPropagation()}
              onDragStart={(event) => onDragStart(event, ticket)}
              onDragEnd={onDragEnd}
              onPointerDown={(event) => onPointerDragStart(event, ticket)}
              className="mt-0.5 grid h-5 w-5 shrink-0 cursor-grab place-items-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold leading-5 text-white">{ticket.businessName}</h3>
              <p className="mt-1 text-xs text-slate-500">Updated {ticket.createdAt}</p>
            </div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-950">{ticket.score}/9</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPills[ticket.status]}`}>{ticketStatusDisplayLabel(ticket.status)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {ticket.status !== "open" && (
          <button type="button" onClick={(event) => handleStatusClick(event, "open")} className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/[0.06]">
            <RotateCcw className="mr-1 inline h-3.5 w-3.5" /> Reopen
          </button>
        )}
        {ticket.status === "open" && (
          <button type="button" onClick={(event) => handleStatusClick(event, "contacted")} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-100 hover:bg-sky-300/15">
            Mark contacted
          </button>
        )}
        {ticket.status !== "won" && (
          <button type="button" onClick={(event) => handleStatusClick(event, "won")} className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-violet-100 hover:bg-violet-300/15">
            Mark won
          </button>
        )}
        {ticket.status !== "lost" && (
          <button type="button" onClick={(event) => handleStatusClick(event, "lost")} className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-rose-100 hover:bg-rose-300/15">
            Mark lost
          </button>
        )}
      </div>
    </article>
  );
}

function BusinessContextDialog({ business, ticket, onClose }: { business: Business; ticket?: Ticket; onClose: () => void }) {
  const websiteUrl = safeExternalUrl(business.website);
  const phoneHref = business.phone ? `tel:${business.phone.replace(/[^\d+]/g, "")}` : null;
  const generatedBrief = business.aiSummary ?? business.reasoning;
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-xl"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-business-context-title"
        tabIndex={-1}
        className="max-h-[min(88vh,900px)] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#101114] p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Business context</p>
            <h2 id="ticket-business-context-title" className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {business.name}
            </h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-100" />
              <span>{business.address}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close business context"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-100">{formatBusinessCategory(business.category)}</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-slate-300">{business.borough}</span>
          {ticket && <span className={`rounded-full border px-3 py-1.5 ${statusPills[ticket.status]}`}>{ticketStatusDisplayLabel(ticket.status)}</span>}
          <span className="rounded-full bg-white px-3 py-1.5 text-slate-950">{business.voiceAiScore}/9 fit</span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.85fr)]">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-indigo-200" /> Saved generated brief
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">{generatedBrief}</p>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="grid gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Best use case</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{business.recommendedUseCase}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-slate-500">Score</p>
                  <p className="mt-1 text-2xl font-black text-white">{business.voiceAiScore}/9</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Star className="h-3.5 w-3.5 text-amber-100" /> Reviews
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{formatReviewText(business)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    Website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {phoneHref && (
                  <a
                    href={phoneHref}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>

        {business.aiAngle && (
          <section className="mt-4 rounded-2xl border border-indigo-300/20 bg-indigo-300/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-100">Outreach angle</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">{business.aiAngle}</p>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Review signals</p>
          {business.reviewPainSignals.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-300 sm:grid-cols-2">
              {business.reviewPainSignals.map((signal) => (
                <li key={signal} className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  {signal}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-400">No saved review pain signals for this business.</p>
          )}
        </section>
      </section>
    </div>
  );
}

function ConfirmationDialog({
  change,
  rememberDismissal,
  onRememberDismissal,
  onCancel,
  onConfirm,
}: {
  change: PendingStatusChange;
  rememberDismissal: boolean;
  onRememberDismissal: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(onCancel);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-xl">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-status-confirmation-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[#101114] p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-amber-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {change.source === "drag" ? "Drag-and-drop move" : "Status change"}
            </p>
            <h2 id="ticket-status-confirmation-title" className="mt-2 text-xl font-semibold text-white">
              Move this ticket?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Confirm moving <span className="font-semibold text-slate-100">{change.ticket.businessName}</span> from{" "}
              <span className="font-semibold text-slate-100">{ticketStatusDisplayLabel(change.ticket.status)}</span> to{" "}
              <span className="font-semibold text-slate-100">{ticketStatusDisplayLabel(change.status)}</span>.
            </p>
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={rememberDismissal}
            onChange={(event) => onRememberDismissal(event.target.checked)}
            className="mt-1 h-4 w-4 accent-indigo-400"
          />
          <span>
            Don&apos;t show this confirmation again for the rest of this browser session.
            <span className="mt-1 block text-xs leading-5 text-slate-500">It resets on a new session, and you can restore confirmations from the board reminder.</span>
          </span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Confirm move <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

function formatBusinessCategory(category: Business["category"]) {
  return getCategoryLabel(category);
}

function formatReviewText(business: Business) {
  const rating = typeof business.rating === "number" ? `${business.rating.toFixed(1)}` : "No rating";
  if (typeof business.reviewCount !== "number") return rating;
  return `${rating} / ${business.reviewCount.toLocaleString("en-GB")}`;
}

function safeExternalUrl(url?: string) {
  if (!url) return null;

  try {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsedUrl = new URL(normalizedUrl);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? parsedUrl.href : null;
  } catch {
    return null;
  }
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
