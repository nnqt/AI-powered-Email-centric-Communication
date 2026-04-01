import { redirect } from "next/navigation";

export default function ContactsDuplicatesRedirectPage() {
  redirect("/contacts/verify");
}
