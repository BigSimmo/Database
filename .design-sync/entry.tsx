// design-sync bundle entry — the app has no library build, so this file
// enumerates the design-layer surface that syncs to claude.ai/design.
// Components AND the utility class-string vocabulary both ride along.
export * from "@/components/ui-primitives";
export { Sheet } from "@/components/ui/sheet";
export { SafeBoldText } from "@/components/SafeBoldText";
export { AccessibleTable } from "@/components/AccessibleTable";

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
