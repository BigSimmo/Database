import {
  BedDouble,
  BookOpen,
  Brain,
  ClipboardList,
  DoorOpen,
  Feather,
  House,
  ListChecks,
  MapPin,
  MessageCircle,
  Phone,
  Scale,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Module icon names used in content files. Task 6 pins these keys to `moduleIcons`. */
export const FIRST_NATIONS_ICONS = {
  users: Users,
  phone: Phone,
  message: MessageCircle,
  check: ListChecks,
  clipboard: ClipboardList,
  brain: Brain,
  house: House,
  "map-pin": MapPin,
  feather: Feather,
  scale: Scale,
  shield: Shield,
  book: BookOpen,
  door: DoorOpen,
  bed: BedDouble,
} satisfies Record<string, LucideIcon>;
export type FirstNationsIconName = keyof typeof FIRST_NATIONS_ICONS;
