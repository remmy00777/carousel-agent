import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth";
import { AgentForm } from "../../../components/AgentForm";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 24 }}>Create an AI content agent</h1>
      <AgentForm />
    </main>
  );
}
