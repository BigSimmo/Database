import {
  BookOpen,
  CheckCircle2,
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

type TokenName =
  | "canvas"
  | "rail"
  | "paper"
  | "raised"
  | "inset"
  | "line"
  | "lineStrong"
  | "ink"
  | "graphite"
  | "muted"
  | "soft"
  | "teal"
  | "tealSoft"
  | "blue"
  | "amber"
  | "red";

const tokens: Record<TokenName, string> = {
  canvas: "#FFFFFF",
  rail: "#F7F8FA",
  paper: "#FFFFFF",
  raised: "#FCFCFD",
  inset: "#F1F3F5",
  line: "#E5E7EB",
  lineStrong: "#D0D5DD",
  ink: "#101418",
  graphite: "#111827",
  muted: "#475467",
  soft: "#667085",
  teal: "#0B7A75",
  tealSoft: "#E6F7F5",
  blue: "#2563EB",
  amber: "#A15C07",
  red: "#B42318",
};

const darkTokens = {
  canvas: "#070808",
  rail: "#0D0F10",
  paper: "#111315",
  raised: "#171A1D",
  line: "rgba(255,255,255,0.09)",
  ink: "#F5F7F7",
  muted: "#A7B0AD",
  teal: "#4CCFD0",
  tealSoft: "#12383B",
};

const swatches: Array<[string, TokenName]> = [
  ["Canvas", "canvas"],
  ["Rail", "rail"],
  ["Graphite", "graphite"],
  ["Ink", "ink"],
  ["Teal", "teal"],
  ["Amber", "amber"],
  ["Red", "red"],
  ["Line", "line"],
];

function CssVars({ children }: { children: ReactNode }) {
  return (
    <section
      className="cw-vars"
      style={
        {
          "--cw-canvas": tokens.canvas,
          "--cw-rail": tokens.rail,
          "--cw-paper": tokens.paper,
          "--cw-raised": tokens.raised,
          "--cw-inset": tokens.inset,
          "--cw-line": tokens.line,
          "--cw-line-strong": tokens.lineStrong,
          "--cw-ink": tokens.ink,
          "--cw-graphite": tokens.graphite,
          "--cw-muted": tokens.muted,
          "--cw-soft": tokens.soft,
          "--cw-teal": tokens.teal,
          "--cw-teal-soft": tokens.tealSoft,
          "--cw-blue": tokens.blue,
          "--cw-amber": tokens.amber,
          "--cw-red": tokens.red,
        } as CSSProperties
      }
    >
      {children}
    </section>
  );
}

function Swatch({ label, token }: { label: string; token: TokenName }) {
  return (
    <div className="cw-swatch">
      <span className="cw-swatch-chip" style={{ background: tokens[token] }} />
      <span>
        <strong>{label}</strong>
        <small>{tokens[token]}</small>
      </span>
    </div>
  );
}

function Sidebar() {
  const tools = [
    { label: "Answer", icon: Sparkles, active: true },
    { label: "Documents", icon: FileText },
    { label: "Medication", icon: Stethoscope },
    { label: "Upload", icon: UploadCloud },
  ];

  return (
    <aside className="cw-sidebar" aria-label="Crisp white sidebar mockup">
      <div className="cw-brand">
        <span>
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <strong>Clinical Guide</strong>
          <small>Verified workspace</small>
        </div>
      </div>

      <button className="cw-primary" type="button">
        <MessageSquarePlus className="h-4 w-4" />
        New chat
      </button>

      <label className="cw-search">
        <Search className="h-4 w-4" />
        <span>Search chats</span>
      </label>

      <p className="cw-label">Workspace</p>
      <div className="cw-tool-list">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button className={tool.active ? "cw-tool active" : "cw-tool"} key={tool.label} type="button">
              <Icon className="h-4 w-4" />
              <span>{tool.label}</span>
            </button>
          );
        })}
      </div>

      <div className="cw-sidebar-fill" />

      <button className="cw-quiet-row" type="button">
        <BookOpen className="h-4 w-4" />
        Guide & help
      </button>
      <button className="cw-user" type="button">
        <span>G</span>
        <span>
          <strong>Guest</strong>
          <small>Not signed in</small>
        </span>
      </button>
    </aside>
  );
}

function Header() {
  return (
    <header className="cw-header">
      <button className="cw-mobile-icon" aria-label="Open sidebar" type="button">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <button className="cw-mode" type="button">
        <span className="cw-mode-icon">
          <Sparkles className="h-4 w-4" />
        </span>
        <span>
          <strong>Answer</strong>
          <small>Source-backed response</small>
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>
      <div className="cw-header-actions">
        <button type="button">New chat</button>
        <button aria-label="More options" type="button">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function Workspace() {
  return (
    <main className="cw-main">
      <Header />
      <section className="cw-workspace">
        <div className="cw-empty">
          <span className="cw-empty-icon">
            <MessageSquare className="h-7 w-7" />
          </span>
          <p className="cw-kicker">Clinical White</p>
          <h2>How can I help?</h2>
          <p className="cw-empty-copy">Ask a clinical question, search documents, or start from a verified source.</p>
        </div>

        <div className="cw-card-grid">
          <button className="cw-action-card active" type="button">
            <Sparkles className="h-5 w-5" />
            <strong>Ask a question</strong>
            <span>Graphite command weight, teal evidence rail.</span>
          </button>
          <button className="cw-action-card" type="button">
            <Search className="h-5 w-5" />
            <strong>Search documents</strong>
            <span>Cool blue metadata keeps teal meaningful.</span>
          </button>
          <button className="cw-action-card" type="button">
            <UploadCloud className="h-5 w-5" />
            <strong>Upload source</strong>
            <span>White cards, nickel lines, low shadow.</span>
          </button>
        </div>

        <section className="cw-answer">
          <div className="cw-answer-head">
            <span>
              <CheckCircle2 className="h-4 w-4" />
              Evidence-backed answer
            </span>
            <small>3 verified sources</small>
          </div>
          <p>
            The answer area stays white and readable. The teal focus rail marks clinical confidence without tinting the
            whole interface.
          </p>
          <div className="cw-source-row">
            <span>Guideline</span>
            <span>Local PDF</span>
            <span>Review due</span>
          </div>
        </section>
      </section>

      <footer className="cw-composer">
        <button aria-label="Add attachment" type="button">
          +
        </button>
        <span>Ask Clinical Guide</span>
        <Mic className="h-4 w-4" />
        <button aria-label="Send" type="button">
          <Send className="h-4 w-4" />
        </button>
      </footer>
    </main>
  );
}

function DesktopMockup() {
  return (
    <CssVars>
      <article className="cw-panel cw-desktop-panel">
        <div className="cw-panel-head">
          <div>
            <p>Desktop mockup</p>
            <h2>Crisp white workspace</h2>
          </div>
          <span>Recommended</span>
        </div>
        <div className="cw-app-frame">
          <Sidebar />
          <Workspace />
        </div>
      </article>
    </CssVars>
  );
}

function MobileMockup() {
  return (
    <CssVars>
      <article className="cw-panel">
        <div className="cw-panel-head">
          <div>
            <p>Mobile mockup</p>
            <h2>White canvas, compact controls</h2>
          </div>
          <span>390px check</span>
        </div>
        <div className="cw-phone-wrap">
          <div className="cw-phone">
            <Header />
            <section className="cw-phone-content">
              <div className="cw-empty compact">
                <span className="cw-empty-icon">
                  <MessageSquare className="h-6 w-6" />
                </span>
                <h2>How can I help?</h2>
                <p className="cw-empty-copy">Ask or search verified sources.</p>
              </div>
              <div className="cw-phone-card active">
                <Sparkles className="h-4 w-4" />
                <strong>Ask a question</strong>
                <span>Clean white card with a teal focus rail.</span>
              </div>
              <div className="cw-phone-card">
                <Search className="h-4 w-4" />
                <strong>Search documents</strong>
                <span>Cool grey field, no cream wash.</span>
              </div>
              <section className="cw-answer phone">
                <div className="cw-answer-head">
                  <span>
                    <CheckCircle2 className="h-4 w-4" />
                    Sources ready
                  </span>
                </div>
                <p>White answer surface. Teal appears only where the user needs evidence state.</p>
              </section>
            </section>
            <footer className="cw-composer phone">
              <button aria-label="Add attachment" type="button">
                +
              </button>
              <span>Ask Clinical Guide</span>
              <button aria-label="Send" type="button">
                <Send className="h-4 w-4" />
              </button>
            </footer>
          </div>
        </div>
      </article>
    </CssVars>
  );
}

function DarkPairing() {
  return (
    <article
      className="cw-dark-panel"
      style={
        {
          "--dk-canvas": darkTokens.canvas,
          "--dk-rail": darkTokens.rail,
          "--dk-paper": darkTokens.paper,
          "--dk-raised": darkTokens.raised,
          "--dk-line": darkTokens.line,
          "--dk-ink": darkTokens.ink,
          "--dk-muted": darkTokens.muted,
          "--dk-teal": darkTokens.teal,
          "--dk-teal-soft": darkTokens.tealSoft,
        } as CSSProperties
      }
    >
      <div className="cw-panel-head dark">
        <div>
          <p>Dark pairing check</p>
          <h2>Obsidian stays polished</h2>
        </div>
        <span>No white glare</span>
      </div>
      <div className="cw-dark-frame">
        <aside />
        <main>
          <header>
            <button type="button">
              <Sparkles className="h-4 w-4" />
              Answer
            </button>
            <button aria-label="More" type="button">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </header>
          <section>
            <div>
              <CheckCircle2 className="h-4 w-4" />
              Evidence-backed answer
            </div>
            <p>Dark mode keeps black glass surfaces and uses the same teal signal language.</p>
          </section>
        </main>
      </div>
    </article>
  );
}

export default function CrispWhiteColourSystemPage() {
  return (
    <div className="cw-page">
      <style>{`
        .cw-page {
          min-height: 100dvh;
          background: #ffffff;
          color: #101418;
          padding: clamp(0.875rem, 2vw, 2rem);
        }

        body:has(.cw-page) .floating-composer-edge,
        body:has(.cw-page) .answer-footer-search-edge,
        body:has(.cw-page) .dashboard-composer-edge {
          display: none !important;
        }

        .cw-hero {
          margin: 0 auto 1rem;
          max-width: 86rem;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background:
            linear-gradient(180deg, rgba(247, 248, 250, 0.72), rgba(255, 255, 255, 0) 46%),
            #ffffff;
          padding: clamp(1rem, 2.2vw, 1.6rem);
          box-shadow: 0 18px 44px rgb(16 20 24 / 7%);
        }

        .cw-hero p:first-child,
        .cw-panel-head p,
        .cw-kicker {
          margin: 0 0 0.45rem;
          color: #0b7a75;
          font-size: 0.72rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cw-hero h1 {
          max-width: 58rem;
          margin: 0;
          color: #101418;
          font-size: clamp(2rem, 4.4vw, 4rem);
          font-weight: 720;
          line-height: 1;
          letter-spacing: 0;
        }

        .cw-hero-copy {
          max-width: 64rem;
          margin: 1rem 0 0;
          color: #475467;
          font-size: 1rem;
          line-height: 1.65;
        }

        .cw-principles {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
          margin-top: 1.25rem;
        }

        .cw-principles div {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          padding: 0.85rem;
          box-shadow: 0 1px 2px rgb(16 20 24 / 4%);
        }

        .cw-principles strong {
          display: block;
          color: #111827;
          font-size: 0.85rem;
        }

        .cw-principles span {
          display: block;
          margin-top: 0.25rem;
          color: #667085;
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .cw-content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 1rem;
          max-width: 86rem;
          margin: 0 auto;
        }

        .cw-panel,
        .cw-dark-panel {
          min-width: 0;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #ffffff;
          padding: clamp(0.7rem, 1.5vw, 1rem);
          box-shadow: 0 18px 44px rgb(16 20 24 / 7%);
        }

        .cw-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.8rem;
        }

        .cw-panel-head h2 {
          margin: 0;
          color: #101418;
          font-size: 1.25rem;
          font-weight: 720;
          letter-spacing: 0;
        }

        .cw-panel-head > span {
          border: 1px solid #c7ece8;
          border-radius: 999px;
          background: #e6f7f5;
          color: #0b7a75;
          padding: 0.35rem 0.65rem;
          font-size: 0.74rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .cw-swatch-grid {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          gap: 0.5rem;
          max-width: 86rem;
          margin: 0 auto 1rem;
        }

        .cw-swatch {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 0.45rem;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          padding: 0.48rem;
          box-shadow: 0 1px 2px rgb(16 20 24 / 4%);
        }

        .cw-swatch-chip {
          height: 1.45rem;
          width: 1.45rem;
          border: 1px solid rgb(16 20 24 / 12%);
          border-radius: 999px;
        }

        .cw-swatch strong,
        .cw-swatch small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cw-swatch strong {
          color: #101418;
          font-size: 0.7rem;
        }

        .cw-swatch small {
          color: #667085;
          font-size: 0.64rem;
        }

        .cw-app-frame {
          display: grid;
          grid-template-columns: 16.25rem minmax(0, 1fr);
          min-height: 45rem;
          overflow: hidden;
          border: 1px solid var(--cw-line);
          border-radius: 14px;
          background: var(--cw-canvas);
        }

        .cw-sidebar {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 0.85rem;
          border-right: 1px solid var(--cw-line);
          background: var(--cw-rail);
          padding: 0.95rem;
        }

        .cw-brand {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 0.72rem;
        }

        .cw-brand > span,
        .cw-empty-icon {
          display: grid;
          place-items: center;
          border: 1px solid #c7ece8;
          background: var(--cw-teal-soft);
          color: var(--cw-teal);
        }

        .cw-brand > span {
          height: 2.35rem;
          width: 2.35rem;
          border-radius: 10px;
        }

        .cw-brand strong,
        .cw-brand small,
        .cw-user strong,
        .cw-user small {
          display: block;
          min-width: 0;
        }

        .cw-brand strong {
          color: var(--cw-ink);
          font-size: 0.95rem;
        }

        .cw-brand small,
        .cw-user small {
          color: var(--cw-soft);
          font-size: 0.75rem;
        }

        .cw-primary,
        .cw-search,
        .cw-tool,
        .cw-quiet-row,
        .cw-user,
        .cw-mode,
        .cw-header-actions button,
        .cw-mobile-icon,
        .cw-action-card,
        .cw-answer,
        .cw-composer,
        .cw-composer button,
        .cw-phone-card {
          border: 1px solid var(--cw-line);
          border-radius: 10px;
          font: inherit;
        }

        .cw-primary {
          display: inline-flex;
          min-height: 2.75rem;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-color: transparent;
          background: linear-gradient(180deg, #1c2430, var(--cw-graphite));
          color: #ffffff;
          font-weight: 760;
          box-shadow: 0 10px 22px rgb(17 24 39 / 18%);
        }

        .cw-search {
          display: flex;
          min-height: 2.7rem;
          align-items: center;
          gap: 0.55rem;
          background: var(--cw-paper);
          color: var(--cw-soft);
          padding: 0 0.75rem;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%);
        }

        .cw-label {
          margin: 0;
          color: var(--cw-soft);
          font-size: 0.68rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cw-tool-list {
          display: grid;
          gap: 0.45rem;
        }

        .cw-tool {
          position: relative;
          display: grid;
          min-height: 2.85rem;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 0.55rem;
          background: transparent;
          color: var(--cw-muted);
          padding: 0 0.7rem;
          text-align: left;
          font-size: 0.86rem;
          font-weight: 720;
        }

        .cw-tool.active {
          border-color: var(--cw-line-strong);
          background: var(--cw-paper);
          color: var(--cw-ink);
          box-shadow: 0 1px 2px rgb(16 20 24 / 5%);
        }

        .cw-tool.active::before,
        .cw-action-card.active::before,
        .cw-answer::before,
        .cw-phone-card.active::before {
          content: "";
          position: absolute;
          bottom: 0.55rem;
          left: -1px;
          top: 0.55rem;
          width: 2px;
          border-radius: 999px;
          background: var(--cw-teal);
        }

        .cw-tool svg,
        .cw-action-card svg,
        .cw-phone-card svg {
          color: var(--cw-teal);
        }

        .cw-sidebar-fill {
          flex: 1 1 auto;
          border-top: 1px solid var(--cw-line);
          margin-top: 0.7rem;
        }

        .cw-quiet-row,
        .cw-user {
          display: flex;
          min-height: 2.55rem;
          align-items: center;
          gap: 0.55rem;
          border-color: transparent;
          background: transparent;
          color: var(--cw-muted);
          font-weight: 700;
          padding: 0 0.62rem;
          text-align: left;
        }

        .cw-user {
          border-color: var(--cw-line);
          background: var(--cw-paper);
        }

        .cw-user > span:first-child {
          display: grid;
          height: 2rem;
          width: 2rem;
          place-items: center;
          border-radius: 999px;
          background: var(--cw-inset);
          color: var(--cw-graphite);
          font-size: 0.75rem;
          font-weight: 800;
        }

        .cw-main {
          position: relative;
          min-width: 0;
          background: var(--cw-canvas);
          padding-bottom: 7rem;
        }

        .cw-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          min-height: 4rem;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 1px solid var(--cw-line);
          background: color-mix(in srgb, var(--cw-paper) 94%, transparent);
          padding-inline: 1rem;
        }

        .cw-mobile-icon {
          display: none;
          height: 2.6rem;
          width: 2.6rem;
          place-items: center;
          background: var(--cw-paper);
          color: var(--cw-muted);
        }

        .cw-mode {
          display: grid;
          grid-column: 2;
          width: 17.4rem;
          min-height: 2.8rem;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.55rem;
          background: var(--cw-paper);
          color: var(--cw-ink);
          padding: 0 0.7rem;
          text-align: left;
          box-shadow: 0 8px 18px rgb(16 20 24 / 7%);
        }

        .cw-mode-icon {
          display: grid;
          height: 2rem;
          width: 2rem;
          place-items: center;
          border-radius: 999px;
          background: var(--cw-teal);
          color: #ffffff;
        }

        .cw-mode strong,
        .cw-mode small {
          display: block;
        }

        .cw-mode strong {
          color: var(--cw-ink);
          font-size: 0.86rem;
        }

        .cw-mode small {
          color: var(--cw-soft);
          font-size: 0.72rem;
        }

        .cw-header-actions {
          display: flex;
          grid-column: 3;
          justify-self: end;
          gap: 0.48rem;
        }

        .cw-header-actions button {
          min-height: 2.6rem;
          background: var(--cw-paper);
          color: var(--cw-muted);
          padding: 0 0.8rem;
          font-size: 0.82rem;
          font-weight: 740;
          box-shadow: 0 1px 2px rgb(16 20 24 / 5%);
        }

        .cw-workspace {
          display: grid;
          justify-items: center;
          align-content: center;
          min-height: 33rem;
          padding: 2rem;
          text-align: center;
        }

        .cw-empty-icon {
          height: 4rem;
          width: 4rem;
          margin: 0 auto;
          border-radius: 14px;
        }

        .cw-empty h2 {
          margin: 0.45rem 0 0;
          color: var(--cw-ink);
          font-size: 1.75rem;
          font-weight: 760;
          letter-spacing: 0;
        }

        .cw-empty-copy {
          margin: 0.55rem auto 0;
          max-width: 31rem;
          color: var(--cw-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .cw-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          width: min(39rem, 100%);
          margin-top: 1.45rem;
        }

        .cw-action-card,
        .cw-phone-card {
          position: relative;
          display: grid;
          min-height: 7.2rem;
          align-content: center;
          justify-items: center;
          gap: 0.38rem;
          background: var(--cw-paper);
          color: var(--cw-ink);
          padding: 0.85rem;
          box-shadow: 0 1px 2px rgb(16 20 24 / 5%), 0 12px 28px rgb(16 20 24 / 5%);
        }

        .cw-action-card.active {
          border-color: var(--cw-line-strong);
        }

        .cw-action-card strong,
        .cw-phone-card strong {
          font-size: 0.9rem;
        }

        .cw-action-card span,
        .cw-phone-card span {
          color: var(--cw-muted);
          font-size: 0.78rem;
          line-height: 1.4;
        }

        .cw-answer {
          position: relative;
          display: grid;
          gap: 0.75rem;
          width: min(36rem, 100%);
          margin-top: 1rem;
          background: var(--cw-paper);
          padding: 0.9rem;
          text-align: left;
          box-shadow: 0 1px 2px rgb(16 20 24 / 5%);
        }

        .cw-answer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .cw-answer-head span {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--cw-teal);
          font-size: 0.8rem;
          font-weight: 820;
        }

        .cw-answer-head small {
          color: var(--cw-soft);
          font-size: 0.72rem;
          font-weight: 750;
        }

        .cw-answer p {
          margin: 0;
          color: var(--cw-muted);
          font-size: 0.86rem;
          line-height: 1.55;
        }

        .cw-source-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .cw-source-row span {
          border: 1px solid var(--cw-line);
          border-radius: 999px;
          background: var(--cw-rail);
          color: var(--cw-muted);
          padding: 0.28rem 0.55rem;
          font-size: 0.72rem;
          font-weight: 760;
        }

        .cw-source-row span:first-child {
          border-color: #c7ece8;
          background: var(--cw-teal-soft);
          color: var(--cw-teal);
        }

        .cw-composer {
          position: absolute;
          bottom: 1.4rem;
          left: 50%;
          display: grid;
          width: min(42rem, calc(100% - 3rem));
          min-height: 3.65rem;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 0.5rem;
          transform: translateX(-50%);
          background: color-mix(in srgb, var(--cw-paper) 92%, transparent);
          padding: 0.35rem;
          box-shadow: 0 18px 38px rgb(16 20 24 / 13%), 0 1px 2px rgb(16 20 24 / 7%);
          backdrop-filter: blur(14px);
        }

        .cw-composer > span {
          min-width: 0;
          overflow: hidden;
          color: var(--cw-muted);
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
          font-size: 0.95rem;
          font-weight: 720;
        }

        .cw-composer svg {
          color: var(--cw-soft);
        }

        .cw-composer button {
          display: grid;
          height: 2.85rem;
          width: 2.85rem;
          place-items: center;
          background: var(--cw-rail);
          color: var(--cw-ink);
          font-size: 1.25rem;
          font-weight: 760;
        }

        .cw-composer button:last-child {
          border-color: transparent;
          background: var(--cw-teal);
          color: #ffffff;
        }

        .cw-composer button:last-child svg {
          color: #ffffff;
        }

        .cw-phone-wrap {
          display: grid;
          place-items: center;
          background:
            linear-gradient(180deg, #f7f8fa, #ffffff 48%),
            #ffffff;
          border: 1px solid var(--cw-line);
          border-radius: 14px;
          padding: 1rem;
        }

        .cw-phone {
          position: relative;
          width: min(24.375rem, 100%);
          min-height: 49rem;
          overflow: hidden;
          border: 1px solid var(--cw-line-strong);
          border-radius: 28px;
          background: var(--cw-canvas);
          box-shadow: 0 24px 58px rgb(16 20 24 / 13%);
        }

        .cw-phone .cw-header {
          grid-template-columns: auto minmax(0, 1fr) auto;
          padding-inline: 0.75rem;
        }

        .cw-phone .cw-mobile-icon {
          display: grid;
        }

        .cw-phone .cw-mode {
          grid-column: 2;
          width: min(13rem, 100%);
          justify-self: center;
        }

        .cw-phone .cw-header-actions {
          grid-column: 3;
        }

        .cw-phone .cw-header-actions button:first-child {
          display: none;
        }

        .cw-phone-content {
          display: grid;
          gap: 0.75rem;
          padding: 1rem 0.85rem 6.2rem;
        }

        .cw-empty.compact {
          padding-top: 1rem;
          text-align: center;
        }

        .cw-empty.compact .cw-empty-icon {
          height: 3.35rem;
          width: 3.35rem;
        }

        .cw-empty.compact h2 {
          font-size: 1.35rem;
        }

        .cw-phone-card {
          min-height: 4.8rem;
          justify-items: start;
          text-align: left;
        }

        .cw-answer.phone {
          width: 100%;
          margin-top: 0;
        }

        .cw-composer.phone {
          bottom: 1rem;
          width: calc(100% - 1rem);
          grid-template-columns: auto minmax(0, 1fr) auto;
        }

        .cw-dark-panel {
          border-color: #1d2327;
          background: #070808;
          color: var(--dk-ink);
          box-shadow: 0 22px 52px rgb(0 0 0 / 22%);
        }

        .cw-panel-head.dark h2 {
          color: var(--dk-ink);
        }

        .cw-panel-head.dark p {
          color: var(--dk-teal);
        }

        .cw-panel-head.dark > span {
          border-color: rgba(76, 207, 208, 0.22);
          background: var(--dk-teal-soft);
          color: var(--dk-teal);
        }

        .cw-dark-frame {
          display: grid;
          grid-template-columns: 12rem minmax(0, 1fr);
          min-height: 18rem;
          overflow: hidden;
          border: 1px solid var(--dk-line);
          border-radius: 14px;
          background: var(--dk-canvas);
        }

        .cw-dark-frame aside {
          border-right: 1px solid var(--dk-line);
          background: linear-gradient(180deg, var(--dk-rail), var(--dk-canvas));
        }

        .cw-dark-frame main {
          display: grid;
          align-content: space-between;
          min-width: 0;
          padding: 1rem;
        }

        .cw-dark-frame header {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .cw-dark-frame button,
        .cw-dark-frame section {
          border: 1px solid var(--dk-line);
          border-radius: 10px;
          background: var(--dk-paper);
          color: var(--dk-ink);
        }

        .cw-dark-frame button {
          display: inline-flex;
          min-height: 2.75rem;
          align-items: center;
          gap: 0.5rem;
          padding: 0 0.8rem;
          font-weight: 760;
        }

        .cw-dark-frame button svg,
        .cw-dark-frame section svg {
          color: var(--dk-teal);
        }

        .cw-dark-frame section {
          border-left: 2px solid var(--dk-teal);
          padding: 1rem;
        }

        .cw-dark-frame section div {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--dk-teal);
          font-size: 0.8rem;
          font-weight: 820;
        }

        .cw-dark-frame section p {
          max-width: 36rem;
          margin: 0.6rem 0 0;
          color: var(--dk-muted);
          line-height: 1.55;
        }

        @media (max-width: 900px) {
          .cw-swatch-grid,
          .cw-principles {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .cw-app-frame {
            grid-template-columns: 1fr;
          }

          .cw-sidebar {
            display: none;
          }

          .cw-header {
            grid-template-columns: auto minmax(0, 1fr) auto;
          }

          .cw-mobile-icon {
            display: grid;
          }

          .cw-mode {
            grid-column: 2;
            width: min(14rem, 100%);
          }

          .cw-header-actions {
            grid-column: 3;
          }

          .cw-header-actions button:first-child {
            display: none;
          }

          .cw-card-grid {
            grid-template-columns: 1fr;
          }

          .cw-action-card {
            min-height: 4.85rem;
            justify-items: start;
            text-align: left;
          }

          .cw-dark-frame {
            grid-template-columns: 1fr;
          }

          .cw-dark-frame aside {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .cw-page {
            padding: 0.75rem;
          }

          .cw-swatch-grid,
          .cw-principles {
            grid-template-columns: 1fr;
          }

          .cw-hero h1 {
            font-size: 2rem;
          }

          .cw-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .cw-workspace {
            min-height: 36rem;
            padding: 1rem 0.75rem;
          }

          .cw-composer {
            width: calc(100% - 1rem);
          }
        }
      `}</style>

      <header className="cw-hero">
        <p>Clean colour-system mockups</p>
        <h1>Clinical White: crisp white canvas, graphite command, precise teal signals.</h1>
        <p className="cw-hero-copy">
          This direction removes the cream background entirely. The UI becomes a true white workspace with cool nickel
          borders, low graphite elevation, and a clinical focus rail so teal communicates evidence instead of tinting
          the whole product.
        </p>
        <div className="cw-principles">
          <div>
            <strong>White first</strong>
            <span>Canvas and answer surfaces stay pure white for a cleaner premium read.</span>
          </div>
          <div>
            <strong>Graphite commands</strong>
            <span>Primary actions use graphite so teal can keep clinical meaning.</span>
          </div>
          <div>
            <strong>Nickel hierarchy</strong>
            <span>Depth comes from borders, shadow discipline, and rail separation.</span>
          </div>
          <div>
            <strong>Teal rail</strong>
            <span>Selected and evidence states use a precise 2px clinical focus rail.</span>
          </div>
        </div>
      </header>

      <CssVars>
        <div className="cw-swatch-grid">
          {swatches.map(([label, token]) => (
            <Swatch key={token} label={label} token={token} />
          ))}
        </div>
      </CssVars>

      <div className="cw-content-grid">
        <DesktopMockup />
        <MobileMockup />
        <DarkPairing />
      </div>
    </div>
  );
}
