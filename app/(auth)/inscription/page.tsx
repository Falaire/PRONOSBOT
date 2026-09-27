import { Navbar } from "@/components/Navbar";
import { AuthForm } from "../auth-form";

export default function InscriptionPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-aurora relative">
        <AuthForm mode="inscription" />
      </main>
    </>
  );
}
