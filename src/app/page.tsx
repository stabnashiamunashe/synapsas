import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Landing } from "@/components/Landing";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/app");
  return <Landing loginHref="/login" registerHref="/register" />;
}
