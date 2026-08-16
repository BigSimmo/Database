import type { MetadataRoute } from "next";
import { PRIVATE_APP_ROBOTS_TXT } from "@/lib/crawler-policy";

export default function robots(): MetadataRoute.Robots {
  return PRIVATE_APP_ROBOTS_TXT;
}
