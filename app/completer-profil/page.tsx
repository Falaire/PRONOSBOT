import { Navbar } from "@/components/Navbar";
import { PhoneGateForm } from "./phone-gate-form";

export default function CompleterProfilPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <PhoneGateForm />
      </main>
    </>
  );
}
