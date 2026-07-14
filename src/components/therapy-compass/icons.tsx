import type { CSSProperties, ReactNode } from "react";

type IconProps = { size?: number; strokeWidth?: number; style?: CSSProperties; className?: string };

function makeIcon(children: ReactNode, defaultStroke = 1.7) {
  function Icon({ size = 16, strokeWidth = defaultStroke, style, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        style={style}
        className={className}
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  }
  return Icon;
}

export const SearchIcon = makeIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const SearchXIcon = makeIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5M9 9l4 4M13 9l-4 4" />
  </>,
);
export const ClockIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
export const ShieldIcon = makeIcon(<path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />);
export const ShieldCheckIcon = makeIcon(
  <>
    <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
    <path d="m9.2 12 1.9 1.9 3.7-3.8" />
  </>,
);
export const AlertIcon = makeIcon(
  <>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </>,
);
export const CompassIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.2" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </>,
);
export const FileTextIcon = makeIcon(
  <>
    <path d="M6 3h8l4 4v14H6Z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 16h6" />
  </>,
);
export const ChevronRightIcon = makeIcon(<path d="m9 6 6 6-6 6" />, 1.8);
export const ChevronDownIcon = makeIcon(<path d="m6 9 6 6 6-6" />, 1.8);
export const ArrowLeftIcon = makeIcon(<path d="M19 12H5M11 6l-6 6 6 6" />, 1.9);
export const ArrowRightIcon = makeIcon(<path d="M5 12h14M13 6l6 6-6 6" />, 1.9);
export const ExternalLinkIcon = makeIcon(
  <>
    <path d="M14 4h6v6M20 4l-8 8" />
    <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </>,
);
export const HeartIcon = makeIcon(
  <path d="M12 20s-7-4.4-9.3-9A4.6 4.6 0 0 1 12 6.2 4.6 4.6 0 0 1 21.3 11C19 15.6 12 20 12 20Z" />,
);
// Visually identical to CompassIcon; alias so the two can't drift.
export const TargetIcon = CompassIcon;
export const CrosshairIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
  </>,
);
export const ScaleIcon = makeIcon(
  <>
    <path d="M12 3v18" />
    <path d="m5 7-3 5.5h6L5 7Z" />
    <path d="m19 7-3 5.5h6L19 7Z" />
    <path d="M4 21h16" />
    <path d="M8 7h8" />
  </>,
);
export const InfoIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v.01M11 12h1v4h1" />
  </>,
  1.9,
);
export const SlidersIcon = makeIcon(<path d="M4 6h16M7 12h10M10 18h4" />, 1.8);
export const SparkleIcon = makeIcon(<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3Z" />, 1.6);
export const UsersIcon = makeIcon(
  <>
    <circle cx="8" cy="8" r="2.3" />
    <circle cx="16" cy="8" r="2.3" />
    <path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" />
  </>,
  1.6,
);
export const PathwayIcon = makeIcon(
  <>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <path d="M8.5 6H15a3 3 0 0 1 3 3v6.5M6 8.5v7" />
  </>,
);
export const BookIcon = makeIcon(
  <>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
    <path d="M4 5.5V20.5" />
  </>,
);
export const CopyIcon = makeIcon(
  <>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M4 16V6a2 2 0 0 1 2-2h10" />
  </>,
);
export const PrinterIcon = makeIcon(
  <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6Z" />,
);
export const PlusIcon = makeIcon(<path d="M12 5v14M5 12h14" />, 2);
export const XIcon = makeIcon(<path d="M6 6l12 12M18 6 6 18" />, 1.9);
export const PlayIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m10 8 6 4-6 4Z" />
  </>,
);
export const PersonIcon = makeIcon(
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </>,
);
export const MessageIcon = makeIcon(<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />);
export const ChecklistIcon = makeIcon(<path d="M4 5h13M4 12h13M4 19h13M20 5l-1.5 1.5M20 12l-1.5 1.5M20 19l-1.5 1.5" />);
export const SaveIcon = makeIcon(
  <>
    <path d="M5 4h11l3 3v13H5Z" />
    <path d="M8 4v5h6V4M8 20v-6h8v6" />
  </>,
);
export const DatabaseIcon = makeIcon(<path d="M4 6a8 3 0 1 0 16 0A8 3 0 1 0 4 6M4 6v12a8 3 0 0 0 16 0V6" />, 1.8);
