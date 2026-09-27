/**
 * Bascule entre le paiement manuel (validation humaine d'un dépôt Mobile Money reçu sur un
 * numéro marchand) et le paiement automatisé via CinetPay. Par défaut : "manual", le temps de
 * finaliser le compte marchand CinetPay (voir docs/04-payment-flow.md, section 4.7).
 */
export type PaymentsProvider = "manual" | "cinetpay";

export function getPaymentsProvider(): PaymentsProvider {
  return process.env.PAYMENTS_PROVIDER === "cinetpay" ? "cinetpay" : "manual";
}

export const MANUAL_PAYMENT_INFO = {
  tmoneyNumber: process.env.NEXT_PUBLIC_MANUAL_TMONEY_NUMBER || "",
  floozNumber: process.env.NEXT_PUBLIC_MANUAL_FLOOZ_NUMBER || "",
  holderName: process.env.NEXT_PUBLIC_MANUAL_PAYMENT_HOLDER ?? "KickPredict Togo",
  whatsappNumber: (process.env.NEXT_PUBLIC_MANUAL_WHATSAPP_NUMBER ?? "22890000000").replace(/\D/g, ""),
};
