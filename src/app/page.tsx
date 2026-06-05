import { ProspectDashboard } from "@/app/prospect-dashboard";
import { getBusinesses } from "@/lib/data/businesses";

export default async function Home() {
  const businesses = await getBusinesses();
  return <ProspectDashboard initialBusinesses={businesses} />;
}
