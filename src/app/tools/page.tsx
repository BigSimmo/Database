"use client";

import Link from "next/link";
import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  FileImage,
  Home,
  LayoutList,
  ListChecks,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  UploadCloud,
  Clipboard,
  ClipboardCheck,
  Quote,
} from "lucide-react";
import {
  appBackdrop,
  cn,
  commandInput,
  fieldIcon,
  floatingControl,
  glassPanel,
  panel,
  primaryControl,
  premiumHeaderSurface,
  shellChip,
  textMuted,
  toneDanger,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import {
  defaultFavoriteToolIds,
  quickLaunchSeedToolIds,
  type ToolIconName,
  type ToolItem,
  type ToolStatus,
  toolCatalog,
} from "@/lib/tools";

type ActivityAction = "launch" | "copy";

type ActivityItem = {
  toolTitle: string;
  action: ActivityAction;
  at: number;
};

type HeroStat = {
  key: string;
  label: string;
  value: string;
};

const storageKeys = {
  favorites: "clinical-kb-tools-favorites",
  recent: "clinical-kb-tools-recent",
};

const copiedToolResetMs = 1200;
const maxRecent = 6;
const maxActivityEntries = 8;

const iconRegistry = {
  Search,
  FileImage,
  UploadCloud,
  BookOpen,
  ClipboardCheck,
  ListChecks,
  Sparkles,
  ShieldAlert,
  Quote,
  Target,
  ExternalLink,
  Clipboard,
} satisfies Record<ToolIconName, ComponentType<{ className?: string }>>;

const statusLabel: Record<ToolStatus, string> = {
  online: "Online",
  beta: "Beta",
  offline: "Offline",
  "coming-soon": "Coming Soon",
};

const statusTone: Record<ToolStatus, string> = {
  online: toneSuccess,
  beta: toneWarning,
  offline: toneDanger,
  "coming-soon": toneNeutral,
};

const statusGlyph: Record<ToolStatus, ReactNode> = {
  online: <Check className="h-3.5 w-3.5" />,
  beta: <Sparkles className="h-3.5 w-3.5" />,
  offline: <CircleDashed className="h-3.5 w-3.5" />,
  "coming-soon": <Clock3 className="h-3.5 w-3.5" />,
};

const categoryTheme: Record<string, { ring: string; stripe: string; tone: string; accent: string }> = {
  Clinical: {
    ring: "border-cyan-200/40",
    stripe: "from-cyan-300 to-cyan-100/40",
    tone: "bg-cyan-300/10",
    accent: "text-cyan-200",
  },
  Operations: {
    ring: "border-amber-200/35",
    stripe: "from-amber-300 to-amber-100/40",
    tone: "bg-amber-300/10",
    accent: "text-amber-200",
  },
  Docs: {
    ring: "border-violet-200/40",
    stripe: "from-violet-300 to-violet-100/40",
    tone: "bg-violet-300/10",
    accent: "text-violet-200",
  },
  Research: {
    ring: "border-emerald-200/40",
    stripe: "from-emerald-300 to-emerald-100/40",
    tone: "bg-emerald-300/10",
    accent: "text-emerald-200",
  },
  Admin: {
    ring: "border-fuchsia-200/35",
    stripe: "from-fuchsia-300 to-fuchsia-100/40",
    tone: "bg-fuchsia-300/10",
    accent: "text-fuchsia-200",
  },
  default: {
    ring: "border-slate-200/35",
    stripe: "from-slate-300 to-slate-100/40",
    tone: "bg-slate-300/10",
    accent: "text-slate-200",
  },
};

function normalizeForSearch(tool: ToolItem) {
  return `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
}

function isInactive(tool: ToolItem) {
  return tool.status === "offline" || tool.status === "coming-soon";
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HeroStatChip({ stat }: { stat: HeroStat }) {
  return (
    <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.12em] text-white/70">{stat.label}</p>
      <p className="mt-1 text-xl font-black text-white">{stat.value}</p>
    </div>
  );
}

function LuxBadge({
  icon: Icon,
  label,
}: {
  icon: typeof Search;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
      <Icon className="h-3.5 w-3.5 text-cyan-100" />
      {label}
    </span>
  );
}

function ActionLink({
  href,
  disabled,
  target,
  rel,
  onClick,
  children,
}: {
  href?: string;
  disabled?: boolean;
  target?: string;
  rel?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (disabled || !href) {
    return (
      <span className={cn(floatingControl, "cursor-not-allowed border-dashed bg-[color:var(--surface)]/35 text-[color:var(--text-muted)]")}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      className={cn(primaryControl, "h-9 px-4 text-xs")}
    >
      {children}
    </a>
  );
}

function ToolTile({
  tool,
  isFavorite,
  copied,
  onOpen,
  onCopy,
  onFavorite,
}: {
  tool: ToolItem;
  isFavorite: boolean;
  copied: boolean;
  onOpen: (tool: ToolItem) => void;
  onCopy: (tool: ToolItem) => void;
  onFavorite: (tool: ToolItem) => void;
}) {
  const theme = categoryTheme[tool.category] ?? categoryTheme.default;
  const Icon = iconRegistry[tool.icon];
  const disabled = isInactive(tool);
  const target = tool.target === "external" && tool.openInNewTab ? "_blank" : undefined;
  const rel = tool.target === "external" ? "noopener noreferrer" : undefined;

  return (
    <article
      className={cn(
        glassPanel,
        "group relative overflow-hidden rounded-[1.35rem] border-2 p-4 transition duration-300",
        theme.ring,
        "hover:translate-y-[-2px]",
        disabled && "opacity-85 grayscale-[0.1]",
      )}
    >
      <div className={`pointer-events-none absolute -right-20 -top-12 h-32 w-32 rounded-full bg-gradient-to-b ${theme.stripe} opacity-80 blur-3xl`} />
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.stripe}`} />
      <div className={cn("absolute inset-x-2 top-1/2 -z-10 h-40 w-[calc(100%-1rem)] -translate-y-1/2 bg-gradient-to-r opacity-40", theme.tone)} />

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl border text-sm shadow-[var(--shadow-inset)]",
              theme.ring.replace("border", "bg"),
              "bg-[color:var(--surface-lux)] text-[color:var(--text)]",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[0.68rem] font-semibold", statusTone[tool.status])}>
            {statusGlyph[tool.status]}
            {statusLabel[tool.status]}
          </span>
        </div>

        <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em]", theme.accent, statusTone[tool.status])}>
          {tool.category}
        </div>

        <div>
          <h3 className="text-base font-black uppercase tracking-[0.05em] text-[color:var(--text-heading)]">{tool.title}</h3>
          <p className={cn("mt-2 text-xs leading-6", textMuted)}>{tool.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[color:var(--text-muted)]">
            {tool.target}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[color:var(--text-muted)]">
            <ExternalLink className="h-3 w-3" />
            {tool.openInNewTab ? "external" : "embedded"}
          </span>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[color:var(--border)] to-transparent" />

        <div className="flex flex-wrap gap-2">
          <ActionLink href={disabled ? undefined : tool.href} target={target} rel={rel} onClick={() => onOpen(tool)} disabled={disabled}>
            <ArrowRight className="h-3.5 w-3.5" />
            {disabled ? "Unavailable" : "Launch app"}
          </ActionLink>
          <button
            type="button"
            className={cn(floatingControl, "h-9 px-3 text-xs")}
            onClick={() => onCopy(tool)}
          >
            <Clipboard className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy deep link"}
          </button>
          <button
            type="button"
            className={cn(
              floatingControl,
              "h-9 px-3 text-xs",
              isFavorite && "border-[color:var(--success)] text-[color:var(--success)]",
            )}
            onClick={() => onFavorite(tool)}
            aria-pressed={isFavorite}
            aria-label={`toggle ${tool.title} favorite`}
          >
            <Star className="h-3.5 w-3.5" />
            {isFavorite ? "Saved" : "Save"}
          </button>
        </div>

        {tool.disabledHint && disabled ? (
          <p className={cn("text-xs", textMuted)}>{tool.disabledHint}</p>
        ) : null}
      </div>
    </article>
  );
}

function QuickCard({
  tool,
  onCopy,
  onFavorite,
  onOpen,
  isFavorite,
}: {
  tool: ToolItem;
  onCopy: (tool: ToolItem) => void;
  onFavorite: (tool: ToolItem) => void;
  onOpen: (tool: ToolItem) => void;
  isFavorite: boolean;
}) {
  const disabled = isInactive(tool);
  const target = tool.target === "external" && tool.openInNewTab ? "_blank" : undefined;

  return (
    <article className={cn(panel, "relative overflow-hidden rounded-2xl p-4")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-black uppercase tracking-[0.07em] text-[color:var(--text-heading)]">{tool.title}</p>
        <span className={cn("inline-flex min-h-7 items-center rounded-full px-2 text-[0.65rem] font-semibold", statusTone[tool.status])}>
          {statusLabel[tool.status]}
        </span>
      </div>
      <p className={cn("mt-2 text-xs", textMuted)}>{tool.description}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={tool.href}
          target={target}
          rel={tool.target === "external" ? "noopener noreferrer" : undefined}
          onClick={() => {
            if (!disabled) onOpen(tool);
          }}
          className={cn(floatingControl, "h-8 px-3 text-xs", disabled && "pointer-events-none opacity-60")}
        >
          Open
        </a>
        <button
          type="button"
          className={cn(floatingControl, "h-8 px-3 text-xs")}
          onClick={() => onCopy(tool)}
        >
          <Clipboard className="h-3.5 w-3.5" />
          Copy
        </button>
        <button
          type="button"
          className={cn(
            floatingControl,
            "h-8 px-3 text-xs",
            isFavorite && "border-[color:var(--success)] text-[color:var(--success)]",
          )}
          aria-label={`toggle ${tool.title} favorite`}
          onClick={() => onFavorite(tool)}
        >
          <Star className="h-3.5 w-3.5" />
          {isFavorite ? "Saved" : "Save"}
        </button>
      </div>

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
        aria-hidden
      />
    </article>
  );
}

export default function ToolsLauncherPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(defaultFavoriteToolIds.slice());
  const [recent, setRecent] = useState<string[]>([]);
  const [copiedToolId, setCopiedToolId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyResetRef = useRef<number | null>(null);

  const categories = useMemo(() => ["All", ...Array.from(new Set(toolCatalog.map((tool) => tool.category)))] as string[], []);
  const toolById = useMemo(() => new Map(toolCatalog.map((tool) => [tool.id, tool])), []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const favoritesRaw = window.localStorage.getItem(storageKeys.favorites);
        const parsed = favoritesRaw ? JSON.parse(favoritesRaw) : null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFavoriteIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      } catch {}

      try {
        const recentRaw = window.localStorage.getItem(storageKeys.recent);
        const parsed = recentRaw ? JSON.parse(recentRaw) : null;
        if (Array.isArray(parsed)) {
          setRecent(parsed.filter((id): id is string => typeof id === "string").slice(0, maxRecent));
        }
      } catch {}
    }, 0);

    return () => {
      window.clearTimeout(hydrationTimer);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKeys.favorites, JSON.stringify(favoriteIds));
    } catch {}
  }, [favoriteIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKeys.recent, JSON.stringify(recent));
    } catch {}
  }, [recent]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return toolCatalog.filter((tool) => {
      const matchesCategory = selectedCategory === "All" || tool.category === selectedCategory;
      const matchesQuery = !normalized || normalizeForSearch(tool).includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory]);

  const quickTools = useMemo(() => {
    const quickIds = [...quickLaunchSeedToolIds, ...defaultFavoriteToolIds, ...recent];
    return Array.from(new Set(quickIds))
      .map((id) => toolById.get(id))
      .filter((tool): tool is ToolItem => Boolean(tool))
      .slice(0, 6);
  }, [recent, toolById]);

  const activeCount = useMemo(() => toolCatalog.filter((tool) => !isInactive(tool)).length, []);
  const inactiveCount = useMemo(() => toolCatalog.filter((tool) => isInactive(tool)).length, []);
  const unavailable = useMemo(() => filteredTools.filter((tool) => isInactive(tool)), [filteredTools]);

  const heroStats = useMemo<HeroStat[]>(
    () => [
      { key: "active", label: "Active tools", value: `${activeCount}` },
      { key: "visible", label: "Visible", value: `${filteredTools.length}` },
      { key: "fav", label: "Saved", value: `${favoriteIds.length}` },
      { key: "rec", label: "Recent", value: `${recent.length}` },
    ],
    [activeCount, filteredTools.length, favoriteIds.length, recent.length],
  );

  const logActivity = useCallback((tool: ToolItem, action: ActivityAction) => {
    setActivity((current) => [{ toolTitle: tool.title, action, at: Date.now() }, ...current].slice(0, maxActivityEntries));
  }, []);

  const handleOpen = useCallback(
    (tool: ToolItem) => {
      if (isInactive(tool)) {
        return;
      }
      logActivity(tool, "launch");
      setRecent((current) => [tool.id, ...current.filter((id) => id !== tool.id)].slice(0, maxRecent));
    },
    [logActivity],
  );

  const handleCopy = useCallback(
    (tool: ToolItem) => {
      if (typeof navigator === "undefined") {
        return;
      }
      void navigator.clipboard.writeText(tool.href).then(
        () => {
          logActivity(tool, "copy");
          setCopiedToolId(tool.id);
          if (copyResetRef.current) {
            window.clearTimeout(copyResetRef.current);
          }
          copyResetRef.current = window.setTimeout(() => {
            setCopiedToolId(null);
          }, copiedToolResetMs);
        },
        () => {
          setCopyError("Clipboard blocked. Please copy manually.");
          if (copyResetRef.current) {
            window.clearTimeout(copyResetRef.current);
          }
          copyResetRef.current = window.setTimeout(() => setCopyError(null), 2400);
        },
      );
    },
    [logActivity],
  );

  const toggleFavorite = useCallback((tool: ToolItem) => {
    setFavoriteIds((current) =>
      current.includes(tool.id) ? current.filter((id) => id !== tool.id) : [...current, tool.id],
    );
  }, []);

  const favoritesPanelTools = useMemo(
    () => favoriteIds.map((id) => toolById.get(id)).filter((tool): tool is ToolItem => Boolean(tool)),
    [favoriteIds, toolById],
  );

  return (
    <div className={cn(appBackdrop, "relative min-h-full overflow-hidden")}>
      <div className="mx-auto min-h-full max-w-7xl px-3 py-6 sm:px-5 sm:py-8">
        <header className={cn(premiumHeaderSurface, "relative overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-lux)]")}>
          <div className="absolute -left-28 top-0 h-64 w-64 rounded-full bg-fuchsia-400/25 blur-[120px]" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/25 blur-[130px] opacity-80" />
          <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-400/25 blur-[130px]" />

          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                <Sparkles className="h-3.5 w-3.5 text-cyan-100" />
                Clinical KB Tools Atelier
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-100" />
                System: online
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.13em] text-white/90">Control plane</p>
                <h1 className="mt-1.5 text-4xl leading-tight font-black tracking-tight text-white sm:text-6xl">
                  Premium Tools Command Studio
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/85 sm:text-base">
                  A polished launcher for all clinical and operational utility destinations. Filter, launch, copy, and curate
                  your most-used tools from one premium surface.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <LuxBadge icon={BookOpen} label={`${toolCatalog.length} total destinations`} />
                <LuxBadge icon={ShieldAlert} label={`${inactiveCount} maintenance states`} />
              </div>
            </div>

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {heroStats.map((stat) => (
                <HeroStatChip key={stat.key} stat={stat} />
              ))}
            </section>
          </div>
        </header>

        <section className="mt-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative block">
              <Search className={cn(fieldIcon, "text-[color:var(--text-soft)]")} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, category, or purpose..."
                className={cn(commandInput, "h-12 text-base", "bg-[color:var(--surface-lux)]/80")}
                aria-label="Search tools"
              />
            </label>

            <div className="flex flex-wrap items-center justify-start gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                className={cn(
                  shellChip,
                  selectedCategory === "All"
                    ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                    : "text-[color:var(--text)]",
                )}
              >
                All
              </button>
              {categories
                .filter((category) => category !== "All")
                .map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      shellChip,
                      selectedCategory === category
                        ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                        : "text-[color:var(--text)]",
                    )}
                  >
                    {category}
                  </button>
                ))}
            </div>
          </div>

          <p className={cn("mt-3 text-xs font-semibold uppercase tracking-[0.08em]", textMuted)}>
            {query.trim() || selectedCategory !== "All" ? (
              <>
                Showing <strong>{filteredTools.length}</strong> tool{filteredTools.length === 1 ? "" : "s"} for
                {query.trim() ? ` "${query.trim()}"` : ""} {selectedCategory !== "All" ? `in ${selectedCategory}` : "across all categories"}.
              </>
            ) : (
              <>Showing all active catalog tools. Use search or category filters to narrow quickly.</>
            )}
          </p>
        </section>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="space-y-4">
            <section className={cn(panel, "rounded-[1.35rem] p-4")}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.11em] text-[color:var(--text)]">Priority launch stream</p>
                  <p className={cn("text-xs", textMuted)}>Top picks from recent activity and your saved favorites.</p>
                </div>
                <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  {quickTools.length} cards
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickTools.length === 0 ? (
                  <div className={cn("rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 text-sm", textMuted)}>
                    Launch a tool to seed this row.
                  </div>
                ) : (
                  quickTools.map((tool) => (
                    <QuickCard
                      key={tool.id}
                      tool={tool}
                      onCopy={handleCopy}
                      onFavorite={toggleFavorite}
                      onOpen={handleOpen}
                      isFavorite={favoriteIds.includes(tool.id)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className={cn(panel, "rounded-[1.35rem] p-4")}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.11em] text-[color:var(--text)]">{selectedCategory} catalog</p>
                  <p className={cn("text-xs", textMuted)}>All cards support instant actions and persistence.</p>
                </div>
                <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  {filteredTools.length === 0 ? "No matches" : `${filteredTools.length} visible`}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredTools.length === 0 ? (
                  <div className={cn(panel, "p-4")}>
                    <p className={cn("rounded-lg border border-dashed border-[color:var(--border)] p-4 text-sm", textMuted)}>
                      No tools match this query or category.
                    </p>
                  </div>
                ) : (
                  filteredTools.map((tool) => (
                    <ToolTile
                      key={tool.id}
                      tool={tool}
                      isFavorite={favoriteIds.includes(tool.id)}
                      copied={copiedToolId === tool.id}
                      onOpen={handleOpen}
                      onCopy={handleCopy}
                      onFavorite={toggleFavorite}
                    />
                  ))
                )}
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className={cn(panel, "rounded-[1.35rem] p-4")}>
              <p className="text-sm font-black uppercase tracking-[0.11em] text-[color:var(--text)]">Saved workspace</p>
              <p className={cn("mt-1 text-xs", textMuted)}>Persistent favorites for your command stack.</p>
              <div className="mt-3 space-y-2">
                {favoritesPanelTools.length === 0 ? (
                  <p className={cn("rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-sm", textMuted)}>
                    Save tools by clicking the star action.
                  </p>
                ) : (
                  favoritesPanelTools.map((tool) => (
                    <a
                      key={tool.id}
                      href={tool.href}
                      target={tool.target === "external" && tool.openInNewTab ? "_blank" : undefined}
                      rel={tool.target === "external" ? "noopener noreferrer" : undefined}
                      onClick={() => handleOpen(tool)}
                      className="group grid gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
                    >
                      <span>{tool.title}</span>
                      <span className="text-xs text-[color:var(--text-muted)]">{tool.category}</span>
                    </a>
                  ))
                )}
              </div>
            </section>

            <section className={cn(panel, "rounded-[1.35rem] p-4")}>
              <p className="text-sm font-black uppercase tracking-[0.11em] text-[color:var(--text)]">Availability + activity</p>
              <div className="mt-3 space-y-3">
                <div>
                  <p className={cn("mb-2 text-xs font-semibold uppercase tracking-[0.09em]", textMuted)}>Recent actions</p>
                  <div className="space-y-2">
                    {activity.length === 0 ? (
                      <p className={cn("rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs", textMuted)}>
                        No actions yet.
                      </p>
                    ) : (
                      activity.map((event) => (
                        <p
                          key={`${event.toolTitle}-${event.at}`}
                          className={cn("rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs", textMuted)}
                        >
                          <span className="font-semibold text-[color:var(--text)]">{event.toolTitle}</span>{" "}
                          <span>
                            {event.action === "launch" ? "opened" : "copied link"} • {formatTime(event.at)}
                          </span>
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className={cn("mb-2 text-xs font-semibold uppercase tracking-[0.09em]", textMuted)}>Availability</p>
                  <div className="space-y-2">
                    {unavailable.length === 0 ? (
                      <p className={cn("rounded-lg border border-[color:var(--success)]/35 bg-[color:var(--success-soft)] px-3 py-2 text-xs", textMuted)}>
                        All checked tools are online.
                      </p>
                    ) : (
                      unavailable.map((tool) => (
                        <div key={tool.id} className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs">
                          <p className="font-semibold text-[color:var(--warning)]">{tool.title}</p>
                          <p className={textMuted}>{tool.disabledHint ?? statusLabel[tool.status]}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.09em] text-[color:var(--text-muted)]">Quick workspace actions</p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={cn(floatingControl, "h-10 justify-center text-xs")}
                >
                  <Sparkles className="h-4 w-4" />
                  Reset search
                </button>
                <Link href="/" className={cn(floatingControl, "h-10 justify-center text-xs")}>
                  <LayoutList className="h-4 w-4" />
                  Back to dashboard
                </Link>
                <Link href="/tools" className={cn(floatingControl, "h-10 justify-center text-xs")}>
                  <Home className="h-4 w-4" />
                  Refresh studio
                </Link>
              </div>
            </section>
          </aside>
        </div>

        {copyError && (
          <p className={cn("mt-4 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-xs", textMuted)}>
            {copyError}
          </p>
        )}
      </div>
    </div>
  );
}
