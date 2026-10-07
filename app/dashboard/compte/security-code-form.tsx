"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { isPasswordValid, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/password-strength";
import { KeyRound, Check, Eye, EyeOff } from "lucide-react";

/** Permet de définir ou changer le code de sécurité utilisé pour se reconnecter avec email +
 * code, sans attendre un nouvel email à chaque fois. */
export function SecurityCodeForm() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeConfirm, setCodeConfirm] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!isPasswordValid(code)) {
      setError(`Code trop faible. ${PASSWORD_REQUIREMENTS_TEXT}`);
      return;
    }
    if (code !== codeConfirm) {
      setError("Les deux codes ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: code });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setCode("");
    setCodeConfirm("");
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full mt-3" onClick={() => setOpen(true)}>
        <KeyRound className="w-4 h-4" /> Changer mon code de sécurité
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <label className="text-sm text-white/70">Nouveau code de sécurité</label>
        <div className="relative mt-1">
          <input
            required
            type={showCode ? "text" : "password"}
            placeholder="Ex : Africa2024!"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 pr-10 text-white text-sm placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            tabIndex={-1}
          >
            {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <PasswordStrengthMeter password={code} />
        <p className="text-xs text-white/40 mt-1">{PASSWORD_REQUIREMENTS_TEXT}</p>
      </div>
      <div>
        <label className="text-sm text-white/70">Confirme le nouveau code</label>
        <input
          required
          type={showCode ? "text" : "password"}
          placeholder="Ex : Africa2024!"
          value={codeConfirm}
          onChange={(e) => setCodeConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && (
        <p className="text-sm text-brand-400 flex items-center gap-1">
          <Check className="w-4 h-4" /> Code mis à jour !
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "..." : "Enregistrer"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
