import { redirect } from "next/navigation";

export default function MedicationsIndexPage() {
  redirect("/?mode=prescribing");
}
