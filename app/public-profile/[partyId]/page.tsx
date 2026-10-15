import "./public-profile.css";
import PublicProfileClient from "./public-profile-client";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const { partyId } = await params;
  return <PublicProfileClient partyId={partyId} />;
}
