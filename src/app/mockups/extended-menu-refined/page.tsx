import {
  Check,
  FileText,
  Filter,
  GitBranch,
  Globe2,
  ListChecks,
  Menu,
  Mic,
  Plus,
  Quote,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

const navy = "#070f4d";
const teal = "#007f78";
const softTeal = "#e2f5f2";
const line = "#dce5ea";
const muted = "#607283";

function PhoneIconButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button type="button" aria-label={label} className="grid h-12 w-12 place-items-center rounded-full text-[#070f4d]">
      {children}
    </button>
  );
}

function EvidenceChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#dce5ea] bg-white px-5 text-[20px] font-medium text-[#070f4d] shadow-[0_1px_5px_rgb(7_15_77_/_5%)]">
      {children}
    </span>
  );
}

function MenuTile({ icon, label }: { icon: ReactNode; label: ReactNode }) {
  return (
    <button
      type="button"
      className="grid h-[142px] min-w-0 place-items-center rounded-[20px] border border-[#dce5ea] bg-white text-center shadow-[0_8px_22px_rgb(7_15_77_/_5%)]"
    >
      <span className="grid h-12 w-12 place-items-center text-[#070f4d]">{icon}</span>
      <span className="mt-1 text-[20px] font-medium leading-[1.15] text-[#070f4d]">{label}</span>
    </button>
  );
}

function MonitoringTable() {
  const rows = [
    ["Full blood count (FBC)", true, true, true, true],
    ["Absolute neutrophil count (ANC)", true, true, true, true],
    ["C-reactive protein (CRP)", false, false, true, true],
  ] as const;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#dce5ea] bg-white shadow-[0_12px_35px_rgb(7_15_77_/_7%)]">
      <div className="flex min-h-[76px] items-center justify-between border-b border-[#dce5ea] px-7">
        <h2 className="text-[26px] font-semibold leading-tight text-[#070f4d]">Clozapine monitoring schedule</h2>
        <button type="button" aria-label="Open table" className="grid h-10 w-10 place-items-center text-[#070f4d]">
          <ListChecks className="h-7 w-7" />
        </button>
      </div>
      <table className="w-full border-collapse text-left text-[#070f4d]">
        <thead>
          <tr className="border-b border-[#dce5ea] text-[15px] font-medium">
            <th className="w-[38%] px-7 py-5">Monitoring item</th>
            <th className="px-3 py-5 text-center">Baseline</th>
            <th className="px-3 py-5 text-center">Weekly</th>
            <th className="px-3 py-5 text-center">Fortnightly</th>
            <th className="px-3 py-5 text-center">4-weekly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, baseline, weekly, fortnightly, fourWeekly]) => (
            <tr key={label} className="border-b border-[#dce5ea] last:border-b-0 text-[18px]">
              <td className="px-7 py-5">{label}</td>
              {[baseline, weekly, fortnightly, fourWeekly].map((enabled, index) => (
                <td key={index} className="px-3 py-5 text-center">
                  {enabled ? <Check className="mx-auto h-6 w-6 text-[#007f78]" /> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CommandSheet() {
  return (
    <section className="absolute inset-x-0 bottom-[96px] z-20 rounded-t-[34px] border border-[#dce5ea] bg-white px-6 pb-5 pt-4 shadow-[0_-20px_55px_rgb(7_15_77_/_12%)]">
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-[#dce5ea]" />

      <div className="grid h-[78px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[24px] bg-[#007f78] px-5 text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_24%),0_10px_24px_rgb(0_127_120_/_22%)]">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/12">
          <Sparkles className="h-7 w-7" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold uppercase leading-none text-white/75">Mode</span>
          <span className="mt-1 block truncate text-[24px] font-semibold leading-none">Answer</span>
          <span className="mt-1 block truncate text-[15px] font-medium leading-none text-white/78">
            Source-backed mode
          </span>
        </span>
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/12">
          <Check className="h-7 w-7" />
        </span>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-4">
        <MenuTile
          icon={<FileText className="h-10 w-10" />}
          label={
            <>
              Add
              <br />
              document
            </>
          }
        />
        <MenuTile
          icon={<Search className="h-11 w-11" />}
          label={
            <>
              Search
              <br />
              library
            </>
          }
        />
        <MenuTile
          icon={<Filter className="h-11 w-11" />}
          label={
            <>
              Scope
              <br />
              sources
            </>
          }
        />
        <MenuTile icon={<Table2 className="h-11 w-11" />} label="Tables" />
        <MenuTile icon={<FileText className="h-10 w-10" />} label="PDFs" />
        <MenuTile icon={<Quote className="h-11 w-11" />} label="Quotes" />
        <MenuTile
          icon={<GitBranch className="h-11 w-11" />}
          label={
            <>
              Evidence
              <br />
              map
            </>
          }
        />
        <MenuTile
          icon={<Wrench className="h-11 w-11" />}
          label={
            <>
              Clinical
              <br />
              tools
            </>
          }
        />
      </div>
    </section>
  );
}

function Composer() {
  return (
    <div className="absolute inset-x-6 bottom-8 z-30 flex h-[72px] items-center gap-3 rounded-full border border-[#dce5ea] bg-white px-2 shadow-[0_10px_30px_rgb(7_15_77_/_10%)]">
      <button
        type="button"
        aria-label="Open command menu"
        className="grid h-16 w-16 place-items-center rounded-full border border-[#dce5ea] bg-white text-[#070f4d]"
      >
        <Plus className="h-8 w-8" />
      </button>
      <span className="min-w-0 flex-1 truncate text-[20px] font-medium text-[#607283]">Ask a clinical question...</span>
      <button type="button" aria-label="Voice input" className="grid h-12 w-12 place-items-center text-[#607283]">
        <Mic className="h-7 w-7" />
      </button>
      <button
        type="button"
        aria-label="Send"
        className="grid h-16 w-16 place-items-center rounded-full bg-[#007f78] text-white shadow-[0_8px_18px_rgb(0_127_120_/_25%)]"
      >
        <Send className="h-8 w-8" />
      </button>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div
      data-refined-extended-menu-phone
      className="relative mx-auto h-[1768px] w-[860px] overflow-hidden rounded-[92px] border border-[#e5e9ed] bg-white shadow-[0_28px_75px_rgb(7_15_77_/_18%)]"
      style={{ color: navy }}
    >
      <div className="absolute inset-[22px] rounded-[76px] border-[7px] border-[#eef1f3]" aria-hidden />
      <div className="absolute left-0 top-[230px] h-16 w-1 rounded-r bg-[#d4d9de]" aria-hidden />
      <div className="absolute left-0 top-[340px] h-[118px] w-1 rounded-r bg-[#d4d9de]" aria-hidden />
      <div className="absolute left-0 top-[494px] h-[118px] w-1 rounded-r bg-[#d4d9de]" aria-hidden />
      <div className="absolute right-0 top-[364px] h-[190px] w-1 rounded-l bg-[#d4d9de]" aria-hidden />

      <div className="relative mx-10 mt-8 h-[1688px] overflow-hidden rounded-[64px] border border-[#e5e9ed] bg-white">
        <header className="flex h-[178px] items-center border-b border-[#dce5ea] px-14 pt-4">
          <div className="absolute left-[76px] top-[42px] text-[28px] font-bold text-black">9:41</div>
          <div className="absolute right-[74px] top-[48px] flex items-center gap-3 text-black">
            <span className="flex items-end gap-1">
              <span className="h-2 w-1.5 rounded bg-black" />
              <span className="h-3.5 w-1.5 rounded bg-black" />
              <span className="h-5 w-1.5 rounded bg-black" />
              <span className="h-7 w-1.5 rounded bg-black" />
            </span>
            <span className="h-5 w-7 rounded-t-full border-t-[5px] border-black" />
            <span className="h-5 w-8 rounded-sm border-2 border-black" />
          </div>

          <div className="mt-14 flex w-full items-center gap-8">
            <PhoneIconButton label="Open menu">
              <Menu className="h-10 w-10" />
            </PhoneIconButton>
            <div className="mx-auto grid h-[64px] w-[354px] grid-cols-2 rounded-[18px] border border-[#dce5ea] bg-white p-1 shadow-[0_2px_8px_rgb(7_15_77_/_4%)]">
              <button
                type="button"
                className="rounded-[14px] bg-[#007f78] text-[22px] font-semibold text-white shadow-[0_5px_12px_rgb(0_127_120_/_22%)]"
              >
                Answer
              </button>
              <button type="button" className="rounded-[14px] text-[21px] font-medium text-[#070f4d]">
                Documents
              </button>
            </div>
            <PhoneIconButton label="Open scope">
              <Globe2 className="h-10 w-10" />
            </PhoneIconButton>
            <PhoneIconButton label="New">
              <Plus className="h-11 w-11" />
            </PhoneIconButton>
          </div>
        </header>

        <main className="relative h-[1414px] bg-white px-8 pt-7">
          <div className="ml-auto mr-5 w-[486px] rounded-[18px] border border-[#dce5ea] bg-[#f6fafb] px-7 py-5 shadow-[0_1px_8px_rgb(7_15_77_/_4%)]">
            <p className="text-[25px] font-medium leading-[1.55] text-[#070f4d]">
              What clozapine monitoring items are shown in the table?
            </p>
            <div className="mt-3 flex items-center justify-end gap-3 text-[18px] text-[#607283]">
              <span>9:14 AM</span>
              <Check className="h-6 w-6 text-[#007f78]" />
            </div>
          </div>

          <div className="mt-10 grid grid-cols-[72px_minmax(0,1fr)] gap-5 px-6">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#e2f5f2] text-[#007f78]">
              <ShieldCheck className="h-11 w-11" />
            </span>
            <div>
              <p className="max-w-[560px] text-[26px] font-medium leading-[1.55] text-[#070f4d]">
                The table lists key monitoring items for patients taking clozapine, including FBC, ANC, CRP, myocarditis
                review, and metabolic monitoring.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <EvidenceChip>FBC p.2</EvidenceChip>
                <EvidenceChip>ANC quote</EvidenceChip>
                <EvidenceChip>Table</EvidenceChip>
                <EvidenceChip>PDF</EvidenceChip>
                <EvidenceChip>Guideline</EvidenceChip>
              </div>
            </div>
          </div>

          <div className="mt-7 px-5">
            <MonitoringTable />
          </div>

          <CommandSheet />
          <Composer />
        </main>

        <div className="absolute bottom-5 left-1/2 z-40 h-1.5 w-[256px] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}

export default function RefinedExtendedMenuMockupPage() {
  return (
    <main
      data-extended-menu-refined
      className="min-h-screen bg-[#f4f7f8] px-6 py-10 text-[#070f4d]"
      style={
        {
          "--mockup-teal": teal,
          "--mockup-soft-teal": softTeal,
          "--mockup-line": line,
          "--mockup-muted": muted,
        } as React.CSSProperties
      }
    >
      <style>{`
        body:has([data-extended-menu-refined]) form:has([data-testid="global-search-input"]) {
          display: none !important;
        }
        body:has([data-extended-menu-refined]) {
          background: #f4f7f8;
        }
      `}</style>
      <PhoneMockup />
    </main>
  );
}
