import test from "node:test";
import assert from "node:assert/strict";
import { generateMuapiVideoToVideo, parseMuapiBalance, preflightMuapiVideo } from "../features/posetrace/providers/muapi";

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

test("MuAPI: refuse tout appel avant le consentement d’envoi et le mode crédits gratuits", async () => {
  let requests = 0;
  const fetchMock = async () => { requests += 1; return reply({}); };
  await assert.rejects(() => preflightMuapiVideo({
    apiKey: "local-test-key",
    modelId: "runway-aleph-v2v",
    prompt: "personnages stickman au trait noir sur papier clair",
    durationSeconds: 5,
    uploadConfirmed: false,
    freeOnlyConfirmed: true,
  }, fetchMock), /Confirmez d’abord l’envoi/);
  assert.equal(requests, 0);
});

test("MuAPI: estime le coût et contrôle un solde déclaré avant tout upload", async () => {
  const requests: string[] = [];
  const fetchMock = async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("estimate-cost")) return reply({ cost: 0.35, currency: "USD" });
    if (url.endsWith("/account/balance")) return reply({ balance: 1.2, currency: "USD" });
    throw new Error(`Unexpected request ${url}`);
  };
  const result = await preflightMuapiVideo({
    apiKey: "local-test-key",
    modelId: "runway-aleph-v2v",
    prompt: "personnages stickman au trait noir sur papier clair",
    durationSeconds: 5,
    uploadConfirmed: true,
    freeOnlyConfirmed: true,
  }, fetchMock);
  assert.deepEqual(result.estimate, { amount: 0.35, currency: "USD" });
  assert.deepEqual(result.available, { amount: 1.2, currency: "USD" });
  assert.equal(requests.length, 2);
  assert.ok(requests.every((url) => !url.includes("upload_file")));
});

test("MuAPI: bloque un devis supérieur au solde sans téléverser", async () => {
  let uploadWasAttempted = false;
  const fetchMock = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("estimate-cost")) return reply({ cost: 2, currency: "USD" });
    if (url.endsWith("/account/balance")) return reply({ balance: 1, currency: "USD" });
    if (url.includes("upload_file")) uploadWasAttempted = true;
    throw new Error(`Unexpected request ${url}`);
  };
  await assert.rejects(() => preflightMuapiVideo({
    apiKey: "local-test-key",
    modelId: "runway-aleph-v2v",
    prompt: "transformation cartoon",
    durationSeconds: 5,
    uploadConfirmed: true,
    freeOnlyConfirmed: true,
  }, fetchMock), /inférieur au coût estimé/);
  assert.equal(uploadWasAttempted, false);
});

test("MuAPI: redemande une vérification si le devis change et ne téléverse pas", async () => {
  let estimateCalls = 0;
  let uploadWasAttempted = false;
  const fetchMock = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("estimate-cost")) {
      estimateCalls += 1;
      return reply({ cost: estimateCalls === 1 ? 0.3 : 0.4, currency: "USD" });
    }
    if (url.endsWith("/account/balance")) return reply({ balance: 2, currency: "USD" });
    if (url.includes("upload_file")) uploadWasAttempted = true;
    throw new Error(`Unexpected request ${url}`);
  };
  const reviewed = await preflightMuapiVideo({
    apiKey: "local-test-key", modelId: "runway-aleph-v2v", prompt: "style papier",
    durationSeconds: 5, uploadConfirmed: true, freeOnlyConfirmed: true,
  }, fetchMock);
  await assert.rejects(() => generateMuapiVideoToVideo({
    apiKey: "local-test-key",
    file: { type: "video/mp4", size: 1024, name: "clip.mp4" } as File,
    modelId: "runway-aleph-v2v",
    prompt: "style papier",
    durationSeconds: 5,
    uploadConfirmed: true,
    freeOnlyConfirmed: true,
    reviewedPreflight: reviewed,
    fetchImpl: fetchMock,
  }), /devis a changé/);
  assert.equal(uploadWasAttempted, false);
});

test("MuAPI: échoue fermé si le solde gratuit ou la devise ne sont pas vérifiables", async () => {
  assert.equal(parseMuapiBalance({ account: "ok" }), null);
  assert.deepEqual(parseMuapiBalance({ free_credits: 4.5, currency: "USD" }), { amount: 4.5, currency: "USD" });
  const fetchMock = async (input: RequestInfo | URL) => String(input).includes("estimate-cost")
    ? reply({ cost: 0.2, currency: "USD" })
    : reply({ balance: 10, currency: "CREDITS" });
  await assert.rejects(() => preflightMuapiVideo({
    apiKey: "local-test-key",
    modelId: "runway-aleph-v2v",
    prompt: "transformation cartoon",
    durationSeconds: 5,
    uploadConfirmed: true,
    freeOnlyConfirmed: true,
  }, fetchMock), /Devise du devis/);
});
