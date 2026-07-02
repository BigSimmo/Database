import {
  BookOpen,
  ChevronDown,
  FileText,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

type ThemeMode = "light" | "dark";

const palette = {
  light: {
    label: "Light mode",
    name: "Clinical Porcelain",
    canvas: "#F7F7F4",
    paper: "#FFFFFF",
    raised: "#FCFCFA",
    inset: "#E8EAE4",
    border: "#DFDFD8",
    borderStrong: "#C3C8BF",
    ink: "#111714",
    muted: "#53605A",
    soft: "#7C8780",
    teal: "#0F766E",
    tealSoft: "#E6F2EF",
    amber: "#8F5408",
    amberSoft: "#FFF1D6",
    red: "#B23A48",
    redSoft: "#FDEBED",
    shadow: "25 28 24",
  },
  dark: {
    label: "Dark mode",
    name: "Obsidian Glass",
    canvas: "#070808",
    paper: "#101214",
    raised: "#171A1D",
    inset: "#050606",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    ink: "#F4F7F6",
    muted: "#A7B0AD",
    soft: "#78827F",
    teal: "#4CCFD0",
    tealSoft: "#12383B",
    amber: "#F0C15A",
    amberSoft: "#3B2D12",
    red: "#FF8D96",
    redSoft: "#3E1B22",
    shadow: "0 0 0",
  },
} as const;

const swatches = [
  ["Canvas", "canvas"],
  ["Paper", "paper"],
  ["Ink", "ink"],
  ["Teal", "teal"],
  ["Amber", "amber"],
  ["Red", "red"],
] as const;

function ThemeVars({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const p = palette[mode];
  return (
    <section
      className={`premium-theme premium-theme-${mode}`}
      style={
        {
          "--mock-canvas": p.canvas,
          "--mock-paper": p.paper,
          "--mock-raised": p.raised,
          "--mock-inset": p.inset,
          "--mock-border": p.border,
          "--mock-border-strong": p.borderStrong,
          "--mock-ink": p.ink,
          "--mock-muted": p.muted,
          "--mock-soft": p.soft,
          "--mock-teal": p.teal,
          "--mock-teal-soft": p.tealSoft,
          "--mock-amber": p.amber,
          "--mock-amber-soft": p.amberSoft,
          "--mock-red": p.red,
          "--mock-red-soft": p.redSoft,
          "--mock-shadow": p.shadow,
        } as CSSProperties
      }
    >
      {children}
    </section>
  );
}

function Swatch({ mode, label, token }: { mode: ThemeMode; label: string; token: keyof (typeof palette)["light"] }) {
  const value = palette[mode][token];
  return (
    <div className="premium-swatch">
      <span className="premium-swatch-chip" style={{ background: value }} />
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
    </div>
  );
}

function Sidebar({ mode }: { mode: ThemeMode }) {
  return (
    <aside className="premium-sidebar" aria-label={`${palette[mode].label} sidebar mockup`}>
      <div className="premium-brand">
        <span className="premium-brand-icon">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <span>
          <strong>Clinical Guide</strong>
          <small>Source-backed workspace</small>
        </span>
      </div>

      <button className="premium-primary" type="button">
        <MessageSquarePlus className="h-4 w-4" />
        New chat
      </button>

      <label className="premium-search">
        <Search className="h-4 w-4" />
        <span>Search chats</span>
      </label>

      <div className="premium-section-label">Tools</div>
      <div className="premium-tool-grid">
        <button className="premium-tool active" type="button">
          <Sparkles className="h-4 w-4" />
          Answer
        </button>
        <button className="premium-tool" type="button">
          <FileText className="h-4 w-4" />
          Documents
        </button>
        <button className="premium-tool" type="button">
          <Stethoscope className="h-4 w-4" />
          Meds
        </button>
        <button className="premium-tool" type="button">
          <UploadCloud className="h-4 w-4" />
          Upload
        </button>
      </div>

      <div className="premium-sidebar-spacer" />

      <button className="premium-sidebar-row" type="button">
        <BookOpen className="h-4 w-4" />
        Guide & help
      </button>
      <button className="premium-user" type="button">
        <span>G</span>
        <span>
          <strong>Guest</strong>
          <small>Not signed in</small>
        </span>
      </button>
    </aside>
  );
}

function AppFrame({ mode }: { mode: ThemeMode }) {
  return (
    <ThemeVars mode={mode}>
      <div className="premium-frame">
        <Sidebar mode={mode} />
        <main className="premium-main">
          <header className="premium-header">
            <button className="premium-mode" type="button">
              <span>
                <Sparkles className="h-4 w-4" />
              </span>
              <span>
                <strong>Answer</strong>
                <small>Source-backed clinical answer</small>
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="premium-header-actions">
              <button type="button">New chat</button>
              <button aria-label="More options" type="button">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </header>

          <section className="premium-content">
            <div className="premium-empty-icon">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3>How can I help?</h3>
            <p>Ask a clinical question or search your documents.</p>

            <div className="premium-action-grid">
              <button type="button">
                <Sparkles className="h-5 w-5" />
                <strong>Ask a question</strong>
                <span>Start a source-backed clinical answer.</span>
              </button>
              <button type="button">
                <Search className="h-5 w-5" />
                <strong>Search documents</strong>
                <span>Browse matching files and source sections.</span>
              </button>
              <button type="button">
                <UploadCloud className="h-5 w-5" />
                <strong>Upload document</strong>
                <span>Add a guideline, PDF, or local source.</span>
              </button>
            </div>

            <section className="premium-answer-preview">
              <div>
                <ShieldCheck className="h-5 w-5" />
                <span>Evidence-backed</span>
              </div>
              <p>
                The answer area should read as calm paper, with teal reserved for source confidence and amber reserved
                for setup or safety states.
              </p>
            </section>
          </section>

          <footer className="premium-composer">
            <button aria-label="Add attachment" type="button">
              +
            </button>
            <span>Ask Clinical Guide</span>
            <Mic className="h-4 w-4 premium-muted-icon" />
            <button aria-label="Send" type="button">
              <Send className="h-4 w-4" />
            </button>
          </footer>
        </main>
      </div>
    </ThemeVars>
  );
}

function ThemeCard({ mode }: { mode: ThemeMode }) {
  const p = palette[mode];
  return (
    <article className="premium-theme-card">
      <div className="premium-theme-card-header">
        <div>
          <p>{p.label}</p>
          <h2>{p.name}</h2>
        </div>
        <span>{mode === "light" ? "Primary target" : "Paired system"}</span>
      </div>
      <div className="premium-swatch-grid">
        {swatches.map(([label, token]) => (
          <Swatch key={token} mode={mode} label={label} token={token} />
        ))}
      </div>
      <AppFrame mode={mode} />
    </article>
  );
}

export default function PremiumColourSystemMockupPage() {
  return (
    <div className="premium-page">
      <style>{`
        .premium-page {
          min-height: 100dvh;
          background: #f4f4f1;
          color: #111714;
          padding: clamp(1rem, 2vw, 2rem);
        }

        body:has(.premium-page) .floating-composer-edge,
        body:has(.premium-page) .answer-footer-search-edge,
        body:has(.premium-page) .dashboard-composer-edge {
          display: none !important;
        }

        .premium-intro {
          margin: 0 auto 1.5rem;
          max-width: 76rem;
          border: 1px solid #deded8;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(252,252,250,0.82));
          padding: clamp(1rem, 2.5vw, 1.5rem);
          box-shadow: 0 18px 44px rgb(25 28 24 / 8%);
        }

        .premium-intro p:first-child {
          color: #0f766e;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin: 0 0 0.5rem;
          text-transform: uppercase;
        }

        .premium-intro h1 {
          margin: 0;
          max-width: 56rem;
          color: #090d0b;
          font-size: clamp(2rem, 4vw, 3.75rem);
          font-weight: 680;
          line-height: 0.98;
          letter-spacing: 0;
        }

        .premium-intro-text {
          margin: 1rem 0 0;
          max-width: 58rem;
          color: #4e5851;
          font-size: 1rem;
          line-height: 1.65;
        }

        .premium-principles {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 1.25rem;
        }

        .premium-principles div {
          border: 1px solid #deded8;
          border-radius: 14px;
          background: #fff;
          padding: 0.9rem;
        }

        .premium-principles strong {
          display: block;
          color: #111714;
          font-size: 0.875rem;
        }

        .premium-principles span {
          display: block;
          margin-top: 0.25rem;
          color: #53605a;
          font-size: 0.8125rem;
          line-height: 1.45;
        }

        .premium-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 1rem;
          margin: 0 auto;
          max-width: 86rem;
        }

        .premium-theme-card {
          min-width: 0;
          border: 1px solid #d6d6cf;
          border-radius: 22px;
          background: #fff;
          padding: clamp(0.75rem, 1.5vw, 1rem);
          box-shadow: 0 20px 48px rgb(25 28 24 / 9%);
        }

        .premium-theme-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .premium-theme-card-header p {
          margin: 0 0 0.15rem;
          color: #53605a;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .premium-theme-card-header h2 {
          margin: 0;
          color: #111714;
          font-size: 1.25rem;
          font-weight: 680;
        }

        .premium-theme-card-header > span {
          border: 1px solid #cfd8d4;
          border-radius: 999px;
          background: #e6f2ef;
          color: #0f766e;
          padding: 0.35rem 0.65rem;
          font-size: 0.75rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .premium-swatch-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          margin-bottom: 0.75rem;
        }

        .premium-swatch {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 0.45rem;
          border: 1px solid #e2e2dc;
          border-radius: 12px;
          background: #fbfbf8;
          padding: 0.45rem;
        }

        .premium-swatch-chip {
          height: 1.45rem;
          width: 1.45rem;
          border: 1px solid rgb(0 0 0 / 12%);
          border-radius: 999px;
        }

        .premium-swatch strong,
        .premium-swatch small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .premium-swatch strong {
          color: #111714;
          font-size: 0.72rem;
        }

        .premium-swatch small {
          color: #667068;
          font-size: 0.66rem;
        }

        .premium-theme {
          border-radius: 18px;
          overflow: hidden;
          color: var(--mock-ink);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 70%, transparent), transparent 14rem),
            var(--mock-canvas);
        }

        .premium-frame {
          display: grid;
          grid-template-columns: 16rem minmax(0, 1fr);
          min-height: 43rem;
        }

        .premium-sidebar {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          border-right: 1px solid var(--mock-border);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 74%, transparent), transparent 70%),
            color-mix(in srgb, var(--mock-paper) 76%, var(--mock-canvas));
          padding: 1rem;
        }

        .premium-brand {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.75rem;
          align-items: center;
        }

        .premium-brand-icon,
        .premium-empty-icon {
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--mock-teal) 22%, var(--mock-border));
          background: linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 82%, var(--mock-teal-soft)), var(--mock-teal-soft));
          color: var(--mock-teal);
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%);
        }

        .premium-brand-icon {
          height: 2.35rem;
          width: 2.35rem;
          border-radius: 12px;
        }

        .premium-brand strong,
        .premium-brand small,
        .premium-user strong,
        .premium-user small {
          display: block;
          min-width: 0;
        }

        .premium-brand strong {
          font-size: 0.96rem;
        }

        .premium-brand small,
        .premium-user small {
          color: var(--mock-muted);
          font-size: 0.76rem;
        }

        .premium-primary,
        .premium-search,
        .premium-tool,
        .premium-sidebar-row,
        .premium-user,
        .premium-mode,
        .premium-header-actions button,
        .premium-action-grid button,
        .premium-composer,
        .premium-composer button,
        .premium-answer-preview {
          border: 1px solid var(--mock-border);
          border-radius: 12px;
          font: inherit;
        }

        .premium-primary {
          display: inline-flex;
          min-height: 2.8rem;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-color: transparent;
          background: linear-gradient(180deg, #202621, #101511);
          color: white;
          font-weight: 750;
          box-shadow: 0 12px 24px rgb(25 28 24 / 18%);
        }

        .premium-theme-dark .premium-primary {
          background: linear-gradient(180deg, #58d4d2, #31b8b7);
          color: #041112;
          box-shadow: 0 12px 24px rgb(0 0 0 / 34%);
        }

        .premium-search {
          display: flex;
          min-height: 2.75rem;
          align-items: center;
          gap: 0.55rem;
          background: color-mix(in srgb, var(--mock-paper) 86%, transparent);
          color: var(--mock-muted);
          padding: 0 0.75rem;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 32%);
        }

        .premium-section-label {
          color: var(--mock-soft);
          font-size: 0.68rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .premium-tool-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .premium-tool {
          display: grid;
          min-height: 4rem;
          place-items: center;
          gap: 0.28rem;
          background: linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 92%, transparent), color-mix(in srgb, var(--mock-paper) 72%, var(--mock-canvas)));
          color: var(--mock-ink);
          font-size: 0.78rem;
          font-weight: 750;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%), 0 8px 18px rgb(var(--mock-shadow) / 0.04);
        }

        .premium-tool svg,
        .premium-action-grid svg {
          color: var(--mock-teal);
        }

        .premium-tool.active {
          border-color: color-mix(in srgb, var(--mock-teal) 28%, var(--mock-border-strong));
          background: linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 86%, var(--mock-teal-soft)), color-mix(in srgb, var(--mock-paper) 72%, var(--mock-teal-soft)));
        }

        .premium-sidebar-spacer {
          flex: 1 1 auto;
          border-top: 1px solid var(--mock-border);
          margin-top: 1rem;
        }

        .premium-sidebar-row,
        .premium-user {
          display: flex;
          min-height: 2.6rem;
          align-items: center;
          gap: 0.55rem;
          border-color: transparent;
          background: transparent;
          color: var(--mock-muted);
          font-weight: 680;
          padding: 0 0.6rem;
          text-align: left;
        }

        .premium-user {
          border-color: var(--mock-border);
          background: color-mix(in srgb, var(--mock-paper) 72%, transparent);
        }

        .premium-user > span:first-child {
          display: grid;
          height: 2rem;
          width: 2rem;
          place-items: center;
          border-radius: 999px;
          background: var(--mock-teal-soft);
          color: var(--mock-teal);
          font-size: 0.75rem;
          font-weight: 800;
        }

        .premium-main {
          position: relative;
          min-width: 0;
          padding-bottom: 7rem;
        }

        .premium-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          min-height: 4.2rem;
          border-bottom: 1px solid var(--mock-border);
          background: linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 84%, transparent), color-mix(in srgb, var(--mock-paper) 60%, transparent));
          padding-inline: 1rem;
        }

        .premium-mode {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          grid-column: 2;
          width: 17.5rem;
          min-height: 3rem;
          align-items: center;
          gap: 0.55rem;
          background: color-mix(in srgb, var(--mock-paper) 82%, transparent);
          color: var(--mock-ink);
          padding: 0 0.7rem;
          text-align: left;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%), 0 10px 24px rgb(var(--mock-shadow) / 0.07);
        }

        .premium-mode > span:first-child {
          display: grid;
          height: 2rem;
          width: 2rem;
          place-items: center;
          border-radius: 999px;
          background: var(--mock-teal);
          color: white;
        }

        .premium-mode strong,
        .premium-mode small {
          display: block;
        }

        .premium-mode strong {
          font-size: 0.88rem;
        }

        .premium-mode small {
          color: var(--mock-muted);
          font-size: 0.72rem;
        }

        .premium-header-actions {
          grid-column: 3;
          justify-self: end;
          display: flex;
          gap: 0.5rem;
        }

        .premium-header-actions button {
          min-height: 2.8rem;
          background: color-mix(in srgb, var(--mock-paper) 82%, transparent);
          color: var(--mock-ink);
          padding: 0 0.85rem;
          font-weight: 700;
          box-shadow: 0 8px 18px rgb(var(--mock-shadow) / 0.06);
        }

        .premium-content {
          display: grid;
          place-items: center;
          align-content: center;
          min-height: 31rem;
          padding: 2rem;
          text-align: center;
        }

        .premium-empty-icon {
          height: 4rem;
          width: 4rem;
          border-radius: 18px;
        }

        .premium-content h3 {
          margin: 1.35rem 0 0;
          color: var(--mock-ink);
          font-size: 1.7rem;
          font-weight: 760;
          letter-spacing: 0;
        }

        .premium-content > p {
          margin: 0.65rem 0 0;
          color: var(--mock-muted);
          font-size: 0.95rem;
        }

        .premium-action-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          width: min(36rem, 100%);
          margin-top: 1.5rem;
        }

        .premium-action-grid button {
          display: grid;
          min-height: 7.4rem;
          align-content: center;
          justify-items: center;
          gap: 0.4rem;
          background: linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 94%, transparent), color-mix(in srgb, var(--mock-paper) 72%, var(--mock-canvas)));
          color: var(--mock-ink);
          padding: 0.9rem;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%), 0 12px 28px rgb(var(--mock-shadow) / 0.06);
        }

        .premium-action-grid strong {
          font-size: 0.9rem;
        }

        .premium-action-grid span {
          color: var(--mock-muted);
          font-size: 0.78rem;
          line-height: 1.4;
        }

        .premium-answer-preview {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.75rem;
          width: min(34rem, 100%);
          margin-top: 1rem;
          background: color-mix(in srgb, var(--mock-paper) 76%, transparent);
          padding: 0.85rem;
          text-align: left;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 24%);
        }

        .premium-answer-preview div {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--mock-teal);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .premium-answer-preview p {
          margin: 0;
          color: var(--mock-muted);
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .premium-composer {
          position: absolute;
          left: 50%;
          bottom: 1.5rem;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          width: min(42rem, calc(100% - 3rem));
          min-height: 3.8rem;
          transform: translateX(-50%);
          align-items: center;
          gap: 0.55rem;
          background: linear-gradient(180deg, color-mix(in srgb, var(--mock-paper) 96%, transparent), color-mix(in srgb, var(--mock-paper) 78%, var(--mock-canvas)));
          padding: 0.35rem;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%), 0 20px 46px rgb(var(--mock-shadow) / 0.16);
        }

        .premium-composer > span {
          color: var(--mock-muted);
          font-size: 1rem;
          font-weight: 700;
          text-align: left;
        }

        .premium-composer button {
          display: grid;
          height: 3rem;
          width: 3rem;
          place-items: center;
          background: color-mix(in srgb, var(--mock-paper) 86%, transparent);
          color: var(--mock-ink);
          font-size: 1.35rem;
        }

        .premium-composer button:last-child {
          border-color: transparent;
          background: linear-gradient(145deg, color-mix(in srgb, var(--mock-teal) 70%, #ffffff), var(--mock-teal));
          color: white;
        }

        .premium-muted-icon {
          color: var(--mock-muted);
        }

        .premium-theme-dark {
          box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.04);
        }

        .premium-theme-dark .premium-mode > span:first-child,
        .premium-theme-dark .premium-composer button:last-child {
          color: #041112;
        }

        .premium-theme-dark .premium-theme-card-header h2,
        .premium-theme-dark .premium-swatch strong {
          color: #111714;
        }

        @media (max-width: 720px) {
          .premium-page {
            padding: 0.75rem;
          }

          .premium-principles,
          .premium-swatch-grid {
            grid-template-columns: 1fr;
          }

          .premium-frame {
            grid-template-columns: 1fr;
            min-height: 45rem;
          }

          .premium-sidebar {
            display: none;
          }

          .premium-header {
            grid-template-columns: auto minmax(0, 1fr) auto;
          }

          .premium-mode {
            grid-column: 2;
            width: min(13rem, 100%);
          }

          .premium-header-actions {
            grid-column: 3;
          }

          .premium-header-actions button:first-child {
            display: none;
          }

          .premium-action-grid {
            grid-template-columns: 1fr;
          }

          .premium-action-grid button {
            min-height: 4.55rem;
            justify-items: start;
            text-align: left;
          }

          .premium-composer {
            width: calc(100% - 1rem);
            bottom: 1rem;
          }
        }
      `}</style>

      <header className="premium-intro">
        <p>Premium colour-system mockups</p>
        <h1>Clinical porcelain in light mode, obsidian glass in dark mode.</h1>
        <p className="premium-intro-text">
          This direction makes light mode feel polished and modern by removing the broad mint cast, using graphite for
          command weight, and reserving teal for clinical evidence, source confidence, and send actions. Dark mode keeps
          the black-polish language with the same semantic accents.
        </p>
        <div className="premium-principles">
          <div>
            <strong>Neutral first</strong>
            <span>Canvas and cards are porcelain/graphite, not green-tinted.</span>
          </div>
          <div>
            <strong>Teal has meaning</strong>
            <span>Teal marks answer mode, sources, evidence, and send intent.</span>
          </div>
          <div>
            <strong>One material signature</strong>
            <span>The composer and mode control use a frosted clinical tray treatment.</span>
          </div>
        </div>
      </header>

      <div className="premium-grid">
        <ThemeCard mode="light" />
        <ThemeCard mode="dark" />
      </div>
    </div>
  );
}
