import { HomeExperience } from "@/components/home/home-experience";
import { cookies } from "next/headers";

export default async function HomePage() {
  const cookieStore = await cookies();
  return <HomeExperience showSplash={!cookieStore.has("savitri_foundation_splash_seen")} />;
}
