/**
 * Intégration CinetPay — agrégateur Mobile Money couvrant le Togo (T-Money / Mixx by Yas,
 * Flooz / Moov Money) ainsi que le reste de l'UEMOA.
 * Docs : https://docs.cinetpay.com
 *
 * Flux :
 *  1. initPayment() -> crée une transaction et renvoie une payment_url à ouvrir (redirection
 *     ou webview) dans laquelle le client choisit T-Money / Flooz et confirme sur son téléphone.
 *  2. CinetPay appelle notify_url (webhook, server-to-server) quand le paiement est terminé.
 *  3. Le webhook NE DOIT JAMAIS faire confiance au corps de la requête : on rappelle toujours
 *     verifyTransaction() (endpoint /v2/payment/check) pour confirmer le statut réel avant
 *     d'activer l'abonnement.
 */

const CINETPAY_BASE_URL = "https://api-checkpoint.cinetpay.com/v2";

export type CinetPayChannel = "MOBILE_MONEY" | "ALL";

export type InitPaymentParams = {
  transactionId: string;
  amountFcfa: number;
  description: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  metadata?: string;
};

export type InitPaymentResult = {
  code: string;
  message: string;
  paymentUrl?: string;
  paymentToken?: string;
};

export async function initPayment(params: InitPaymentParams): Promise<InitPaymentResult> {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kickpredict.tg";

  if (!apiKey || !siteId) {
    throw new Error("CINETPAY_API_KEY / CINETPAY_SITE_ID manquants dans l'environnement");
  }

  const body = {
    apikey: apiKey,
    site_id: siteId,
    transaction_id: params.transactionId,
    amount: params.amountFcfa,
    currency: "XOF",
    description: params.description,
    customer_name: params.customerName,
    customer_surname: "",
    customer_phone_number: params.customerPhone,
    customer_email: params.customerEmail ?? "client@kickpredict.tg",
    customer_address: "Lomé",
    customer_city: "Lomé",
    customer_country: "TG",
    customer_state: "TG",
    customer_zip_code: "00000",
    notify_url: `${baseUrl}/api/payments/cinetpay/webhook`,
    return_url: `${baseUrl}/dashboard/abonnement?status=retour`,
    channels: "MOBILE_MONEY" as CinetPayChannel,
    lang: "FR",
    metadata: params.metadata ?? "",
  };

  const res = await fetch(`${CINETPAY_BASE_URL}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (json.code !== "201") {
    throw new Error(`CinetPay init échoué: ${json.code} - ${json.message}`);
  }

  return {
    code: json.code,
    message: json.message,
    paymentUrl: json.data?.payment_url,
    paymentToken: json.data?.payment_token,
  };
}

export type TransactionStatus = {
  status: "ACCEPTED" | "REFUSED" | "PENDING" | "UNKNOWN";
  operatorId?: string;
  paymentMethod?: string; // "TMONEY", "FLOOZ", ...
  amount?: number;
  currency?: string;
  raw: any;
};

export async function verifyTransaction(transactionId: string): Promise<TransactionStatus> {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;

  const res = await fetch(`${CINETPAY_BASE_URL}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: apiKey, site_id: siteId, transaction_id: transactionId }),
  });

  const json = await res.json();
  const data = json.data ?? {};

  let status: TransactionStatus["status"] = "UNKNOWN";
  if (data.status === "ACCEPTED") status = "ACCEPTED";
  else if (data.status === "REFUSED") status = "REFUSED";
  else if (data.status === "PENDING" || data.status === "WAITING_CUSTOMER_ACTION_FOR_REFUND") status = "PENDING";

  return {
    status,
    operatorId: data.operator_id,
    paymentMethod: data.payment_method,
    amount: data.amount,
    currency: data.currency,
    raw: json,
  };
}

/** Mappe un plan interne vers un montant en FCFA (source de vérité côté serveur, jamais côté client) */
export const PLAN_PRICES_FCFA: Record<string, { amount: number; days: number; label: string }> = {
  hebdo: { amount: 1000, days: 7, label: "Hebdo" },
  mensuel: { amount: 3000, days: 30, label: "Mensuel" },
  trimestriel: { amount: 7500, days: 90, label: "Trimestriel" },
  annuel: { amount: 25000, days: 365, label: "Annuel" },
};
