import type { Metadata } from "next";
import { Admin } from "@/components/admin";
export const metadata: Metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Admin />;
}
