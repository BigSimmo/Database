// design-sync bundle entry — the app has no library build, so this file
// enumerates the design-layer surface that syncs to claude.ai/design.
// Components AND the utility class-string vocabulary both ride along.
export * from "@/components/ui-primitives";
export {
  AccessibleTable,
  type AccessibleTableColumnAlign,
  type AccessibleTableProps,
} from "@/components/AccessibleTable";
export { SafeBoldText, type SafeBoldTextProps } from "@/components/SafeBoldText";
export {
  AnswerCard,
  AnswerFooter,
  DoseLine,
  answerClipboardText,
  type AnswerCardProps,
  type AnswerCardAction,
  type AnswerFooterProps,
  type DoseQuantity,
  type DoseLineProps,
  type DoseRow,
  type DoseSourceRef,
} from "@/components/ui/answer-card";
export {
  answerStateFromRetrieval,
  type AnswerState,
  type DegradedAnswerState,
  type OverdueSource,
  type SourceRef,
  type AnswerStateInput,
} from "@/components/ui/answer-state";
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
export {
  Chip,
  ChoiceChip,
  type ChipAppearance,
  type ChipCategoryTone,
  type ChipInformationTone,
  type ChipProps,
  type ChipSize,
  type ChipStatusTone,
  type ChoiceChipProps,
} from "@/components/ui/chip";
export {
  Checkbox,
  RadioGroup,
  type CheckboxProps,
  type RadioGroupProps,
  type RadioOption,
} from "@/components/ui/choice";
export { Citation, CitationList, type CitationListProps, type CitationProps } from "@/components/ui/citation";
export { ConfirmDialog, type ConfirmDialogProps } from "@/components/ui/confirm-dialog";
export { DateDisplay, type DateDisplayKind, type DateDisplayProps } from "@/components/ui/date-display";
export {
  Disclosure,
  DisclosureGroup,
  type DisclosureGroupProps,
  type DisclosureProps,
} from "@/components/ui/disclosure";
export {
  ErrorState,
  errorStateCopy,
  shouldEmitErrorStateDiagnostic,
  type ErrorStateProps,
  type ErrorStateReason,
} from "@/components/ui/error-state";
export {
  ErrorSummary,
  FieldError,
  FieldHint,
  FormField,
  type ErrorSummaryProps,
  type FieldErrorProps,
  type FieldHintProps,
  type FormFieldRenderProps,
  type FormFieldProps,
} from "@/components/ui/form-field";
export {
  DownloadLink,
  ExternalTextLink,
  LinkAction,
  TextLink,
  type DownloadLinkProps,
  type ExternalTextLinkProps,
  type LinkActionProps,
  type TextLinkProps,
} from "@/components/ui/link";
export {
  LiveAnnouncer,
  RouteAnnouncer,
  announce,
  type AnnounceOptions,
  type AnnouncePriority,
} from "@/components/ui/live-announcer";
export { MissingValue, type MissingValueProps, type MissingValueReason } from "@/components/ui/missing-value";
export { OverlayPortal, OverlayRoot, type OverlayLayer, type OverlayPortalProps } from "@/components/ui/overlay-root";
export {
  Breadcrumb,
  PageHeader,
  type BreadcrumbProps,
  type Crumb,
  type PageHeaderProps,
} from "@/components/ui/page-header";
export { Pagination, type PaginationProps } from "@/components/ui/pagination";
export { Progress, StageList, type ProgressProps, type Stage, type StageListProps } from "@/components/ui/progress";
export { Quantity, type QuantityProps } from "@/components/ui/quantity";
export { RetrievalStateBanner, type RetrievalStateBannerProps } from "@/components/ui/retrieval-state-banner";
export {
  SegmentedControl,
  type SegmentedControlOption,
  type SegmentedControlProps,
} from "@/components/ui/segmented-control";
export { Select, type SelectOption, type SelectProps } from "@/components/ui/select";
export { Sheet, type SheetMobileSize, type SheetProps } from "@/components/ui/sheet";
export { StatusMark, type DocumentStatus, type StatusMarkProps } from "@/components/ui/status-mark";
export { Tabs, type TabItem, type TabsProps } from "@/components/ui/tabs";
export { SearchField, TextField, type SearchFieldProps, type TextFieldProps } from "@/components/ui/text-field";
export {
  ToastProvider,
  ToastRegion,
  useToast,
  type Toast,
  type ToastApi,
  type ToastInput,
  type ToastProviderProps,
} from "@/components/ui/toast";
export { Tooltip, type TooltipProps } from "@/components/ui/tooltip";
export {
  VerificationNotice,
  type VerificationNoticeProps,
  type VerificationState,
} from "@/components/ui/verification-notice";
export type { NormalizedAccessibleTable } from "@/lib/accessible-table-normalization";

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
