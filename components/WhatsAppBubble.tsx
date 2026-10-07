import { MessageCircle } from "lucide-react";
import { MANUAL_PAYMENT_INFO } from "@/lib/payments/config";

/**
 * Bulle flottante WhatsApp, visible sur tout le site — contact direct réel (pas un faux chat
 * animé façon "agent en ligne" comme sur certains sites concurrents : juste un lien vrai vers
 * notre numéro WhatsApp support).
 */
export function WhatsAppBubble() {
  if (!MANUAL_PAYMENT_INFO.whatsappNumber) return null;

  return (
    <a
      href={`https://wa.me/${MANUAL_PAYMENT_INFO.whatsappNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter le support sur WhatsApp"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-[0_8px_30px_rgba(37,211,102,0.5)] hover:scale-105 active:scale-95 transition-transform"
    >
      <MessageCircle className="w-6 h-6" fill="currentColor" />
    </a>
  );
}
