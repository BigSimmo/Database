// design-sync bundle entry — the app has no library build, so this file
// enumerates the design-layer surface that syncs to claude.ai/design.
// Components AND the utility class-string vocabulary both ride along.
export * from "@/components/ui-primitives";
export { Sheet } from "@/components/ui/sheet";
export { SafeBoldText } from "@/components/SafeBoldText";
export { AccessibleTable } from "@/components/AccessibleTable";

// Components added in the v2 pass. They close the gaps the design review found:
// nothing in the system owned actions, text entry, filter chips, async outcome
// announcements, in-page section switching, supplementary help text, long-list
// paging, destructive confirmation, or page-level titling.
export { Button } from "@/components/ui/button";
export { TextField, SearchField } from "@/components/ui/text-field";
export { Chip } from "@/components/ui/chip";
export { ToastProvider, ToastRegion, useToast } from "@/components/ui/toast";
export { Tabs } from "@/components/ui/tabs";
export { Tooltip } from "@/components/ui/tooltip";
export { Pagination } from "@/components/ui/pagination";
export { ConfirmDialog } from "@/components/ui/confirm-dialog";
export { PageHeader, Breadcrumb } from "@/components/ui/page-header";
export { AnswerCard, AnswerFooter, DoseLine } from "@/components/ui/answer-card";

// Curated lucide-react icon set: consumers of the synced bundle have no
// lucide-react install, so the icons PanelHeading/EmptyState-style `icon`
// props need must ship with the bundle itself.
export {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  File,
  FileText,
  Filter,
  HeartPulse,
  Inbox,
  Info,
  Loader2,
  Maximize2,
  Pencil,
  Pill,
  Plus,
  Search,
  SearchX,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
