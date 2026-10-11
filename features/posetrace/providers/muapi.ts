import { VIDEO_TO_VIDEO_MODELS, type VideoToVideoModel } from "../models";

const MUAPI_BASE_URL = "https://api.muapi.ai";
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 450;

type MuapiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type MuapiMoney = { amount: number; currency: string };
export type MuapiPreflight = { estimate: MuapiMoney; available: MuapiMoney };
export type MuapiRunOptions = {
  apiKey: string;
  file: File;
  modelId: string;
  prompt: string;
  durationSeconds: number;
  uploadConfirmed: boolean;
  freeOnlyConfirmed: boolean;
  reviewedPreflight: MuapiPreflight;
  onStatus?: (message: string) => void;
  onProgress?: (percent: number) => void;
  onPreflight?: (preflight: MuapiPreflight) => void;
  fetchImpl?: MuapiFetch;
};

const modelsById = new Map(VIDEO_TO_VIDEO_MODELS.map((model) => [model.id, model]));

function modelById(modelId: string): VideoToVideoModel {
  const model = modelsById.get(modelId);
  if (!model) throw new Error("Le modèle vidéo-à-vidéo sélectionné n’est pas pris en charge.");
  return model;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  const object = asObject(value);
  if (!object) return null;
  for (const key of ["amount", "available", "value", "balance", "credits", "free_credits", "freeCredits"]) {
    const amount = object[key];
    if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) return amount;
  }
  return null;
}

/**
 * Le format de réponse du solde peut évoluer côté fournisseur. Si aucun montant
 * exploitable n'est trouvé, le préflight échoue fermé et le fichier n'est pas envoyé.
 */
export function parseMuapiBalance(raw: unknown): MuapiMoney | null {
  const root = asObject(raw);
  if (!root) return null;
  const balance = asObject(root.balance);
  const credits = asObject(root.credits);
  const candidates = [
    root.free_credits,
    root.freeCredits,
    root.available_free_credits,
    root.availableFreeCredits,
    credits?.free,
    credits?.available,
    balance?.free_credits,
    balance?.freeCredits,
    balance?.available,
    balance?.amount,
    root.credits,
    root.available,
    root.balance,
  ];
  const amount = candidates.map(positiveAmount).find((candidate) => candidate !== null);
  if (amount === undefined || amount === null) return null;
  const currencyValue = root.free_currency ?? root.currency ?? balance?.currency ?? credits?.currency;
  const currency = typeof currencyValue === "string" && /^[A-Za-z]{3}$/.test(currencyValue.trim())
    ? currencyValue.trim().toUpperCase()
    : "CREDITS";
  return { amount, currency };
}

async function readJson(response: Response, operation: string): Promise<Record<string, unknown>> {
  if (!response.ok) {
    // Ne pas inclure les en-têtes, qui peuvent contenir la clé d'API, dans les erreurs UI.
    throw new Error(`${operation} refusé par MuAPI (HTTP ${response.status}).`);
  }
  const data: unknown = await response.json();
  const object = asObject(data);
  if (!object) throw new Error(`Réponse MuAPI illisible pendant : ${operation}.`);
  return object;
}

export async function estimateMuapiVideoCost(
  modelId: string,
  prompt: string,
  durationSeconds: number,
  fetchImpl: MuapiFetch = fetch,
): Promise<MuapiMoney> {
  const model = modelById(modelId);
  const response = await fetchImpl(`${MUAPI_BASE_URL}/api/v1/models/${encodeURIComponent(model.endpoint)}/estimate-cost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Estimation sans média : si le fournisseur exige d'abord la vidéo, on s'arrête
    // plutôt que de téléverser un fichier avant de connaître le coût estimé.
    body: JSON.stringify({ prompt, duration: durationSeconds, aspect_ratio: "9:16" }),
  });
  const data = await readJson(response, "l’estimation du coût");
  const amount = typeof data.cost === "number" ? data.cost : Number.NaN;
  const currency = typeof data.currency === "string" ? data.currency.trim().toUpperCase() : "";
  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("MuAPI n’a pas fourni une estimation de coût vérifiable; aucun fichier n’a été envoyé.");
  }
  return { amount, currency };
}

export async function getMuapiBalance(apiKey: string, fetchImpl: MuapiFetch = fetch): Promise<MuapiMoney> {
  const response = await fetchImpl(`${MUAPI_BASE_URL}/api/v1/account/balance`, {
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
  });
  const data = await readJson(response, "la lecture du solde");
  const balance = parseMuapiBalance(data);
  if (!balance) throw new Error("MuAPI n’a pas fourni un solde exploitable; aucun fichier n’a été envoyé.");
  return balance;
}

export async function preflightMuapiVideo(
  options: Pick<MuapiRunOptions, "apiKey" | "modelId" | "prompt" | "durationSeconds" | "uploadConfirmed" | "freeOnlyConfirmed">,
  fetchImpl: MuapiFetch = fetch,
): Promise<MuapiPreflight> {
  if (!options.uploadConfirmed) throw new Error("Confirmez d’abord l’envoi de la vidéo à MuAPI.");
  if (!options.freeOnlyConfirmed) throw new Error("Confirmez l’utilisation d’un compte MuAPI limité à des crédits gratuits.");
  if (!options.apiKey.trim()) throw new Error("Saisissez votre clé MuAPI dans la session du navigateur.");
  if (!options.prompt.trim()) throw new Error("Saisissez une consigne de transformation.");
  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) throw new Error("Durée vidéo invalide.");

  const [estimate, available] = await Promise.all([
    estimateMuapiVideoCost(options.modelId, options.prompt, options.durationSeconds, fetchImpl),
    getMuapiBalance(options.apiKey, fetchImpl),
  ]);
  if (estimate.currency !== available.currency) {
    throw new Error(`Devise du devis (${estimate.currency}) différente du solde (${available.currency}); aucun fichier n’a été envoyé.`);
  }
  if (estimate.amount > available.amount) {
    throw new Error("Le solde disponible est inférieur au coût estimé; aucun fichier n’a été envoyé.");
  }
  return { estimate, available };
}

async function uploadVideo(apiKey: string, file: File, fetchImpl: MuapiFetch): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetchImpl(`${MUAPI_BASE_URL}/api/v1/upload_file`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  const data = await readJson(response, "l’envoi de la vidéo");
  const candidate = data.url ?? data.file_url ?? asObject(data.data)?.url;
  if (typeof candidate !== "string") throw new Error("MuAPI n’a pas retourné d’adresse pour le fichier envoyé.");
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("MuAPI a retourné une adresse média invalide."); }
  if (url.protocol !== "https:") throw new Error("L’adresse média retournée par MuAPI n’est pas sécurisée.");
  return url.toString();
}

async function submitVideo(
  apiKey: string,
  modelId: string,
  videoUrl: string,
  prompt: string,
  durationSeconds: number,
  fetchImpl: MuapiFetch,
): Promise<Record<string, unknown>> {
  const model = modelById(modelId);
  const response = await fetchImpl(`${MUAPI_BASE_URL}/api/v1/${encodeURIComponent(model.endpoint)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ video_url: videoUrl, prompt, duration: durationSeconds, aspect_ratio: "9:16" }),
  });
  return readJson(response, "la création de la tâche vidéo");
}

function resultUrl(data: Record<string, unknown>): string | null {
  const output = asObject(data.output);
  const candidates = [data.url, data.video_url, Array.isArray(data.outputs) ? data.outputs[0] : null, output?.url, output?.video_url];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:") return url.toString();
    } catch { /* ignorer une URL de sortie invalide */ }
  }
  return null;
}

async function pollForResult(
  apiKey: string,
  requestId: string,
  fetchImpl: MuapiFetch,
  onProgress?: (percent: number) => void,
): Promise<Record<string, unknown>> {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const response = await fetchImpl(`${MUAPI_BASE_URL}/api/v1/predictions/${encodeURIComponent(requestId)}/result`, {
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    });
    const result = await readJson(response, "la vérification de la génération");
    const status = typeof result.status === "string" ? result.status.toLowerCase() : "";
    if (["completed", "succeeded", "success"].includes(status)) return result;
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error("MuAPI a échoué à générer la vidéo. Aucun nouvel essai automatique ne sera lancé.");
    }
    onProgress?.(Math.min(95, 50 + Math.round((attempt / MAX_POLL_ATTEMPTS) * 45)));
  }
  throw new Error("La génération MuAPI dépasse le délai d’attente de 15 minutes.");
}

/**
 * Enchaîne uniquement après préflight réussi. Le fichier source ne quitte le
 * navigateur qu'à l'appel uploadVideo, après consentement et contrôle du solde.
 */
export async function generateMuapiVideoToVideo(options: MuapiRunOptions): Promise<{ url: string; preflight: MuapiPreflight }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!options.file.type.startsWith("video/")) throw new Error("Le fichier choisi n’est pas une vidéo.");
  if (options.file.size > 100 * 1024 * 1024) throw new Error("La voie distante est limitée à 100 Mo par vidéo dans ce prototype.");

  const preflight = await preflightMuapiVideo(options, fetchImpl);
  options.onPreflight?.(preflight);
  const quoteChanged = preflight.estimate.currency !== options.reviewedPreflight.estimate.currency
    || Math.abs(preflight.estimate.amount - options.reviewedPreflight.estimate.amount) > 1e-9;
  if (quoteChanged) throw new Error("Le devis a changé depuis votre vérification. Aucun fichier n’a été envoyé; relancez le contrôle et relisez le nouveau devis.");
  options.onStatus?.("Envoi explicite de la vidéo vers MuAPI…");
  options.onProgress?.(15);
  const videoUrl = await uploadVideo(options.apiKey, options.file, fetchImpl);

  options.onStatus?.("Création de la tâche vidéo-à-vidéo…");
  options.onProgress?.(45);
  const submitted = await submitVideo(options.apiKey, options.modelId, videoUrl, options.prompt, options.durationSeconds, fetchImpl);
  const requestId = submitted.request_id ?? submitted.id;
  if (typeof requestId !== "string" && typeof requestId !== "number") {
    const directUrl = resultUrl(submitted);
    if (!directUrl) throw new Error("MuAPI n’a pas retourné d’identifiant de tâche ni de vidéo finale.");
    options.onProgress?.(100);
    return { url: directUrl, preflight };
  }

  options.onStatus?.("MuAPI génère la vidéo; attente du résultat…");
  const result = await pollForResult(options.apiKey, String(requestId), fetchImpl, options.onProgress);
  const url = resultUrl(result);
  if (!url) throw new Error("La tâche est terminée, mais aucune URL de vidéo sécurisée n’a été retournée.");
  options.onProgress?.(100);
  return { url, preflight };
}
