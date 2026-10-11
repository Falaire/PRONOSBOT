"use client";

import { VIDEO_TO_VIDEO_MODELS, type VideoToVideoModel } from "../models";
import type { MuapiPreflight } from "../providers/muapi";

type RemoteGenerationPanelProps = {
  disabled: boolean;
  modelId: string;
  onModelChange: (value: string) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  uploadConsent: boolean;
  onUploadConsentChange: (value: boolean) => void;
  freeOnlyConfirmed: boolean;
  onFreeOnlyConfirmedChange: (value: boolean) => void;
  preflight: MuapiPreflight | null;
  canCheckPreflight: boolean;
  checkingPreflight: boolean;
  onCheckPreflight: () => void;
  models?: VideoToVideoModel[];
};

export default function RemoteGenerationPanel({
  disabled,
  modelId,
  onModelChange,
  apiKey,
  onApiKeyChange,
  prompt,
  onPromptChange,
  uploadConsent,
  onUploadConsentChange,
  freeOnlyConfirmed,
  onFreeOnlyConfirmedChange,
  preflight,
  canCheckPreflight,
  checkingPreflight,
  onCheckPreflight,
  models = VIDEO_TO_VIDEO_MODELS,
}: RemoteGenerationPanelProps) {
  return (
    <section className="remote-panel" aria-label="Paramètres de génération MuAPI">
      <div className="remote-panel-title">
        <div><strong>Studio vidéo-à-vidéo · MuAPI</strong><small>Le fichier reste local tant que vous ne lancez pas ce flux.</small></div>
        <span className="remote-badge">DISTANT</span>
      </div>
      <div className="remote-fields">
        <label>
          Modèle
          <select value={modelId} onChange={(event) => onModelChange(event.target.value)} disabled={disabled}>
            {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
        </label>
        <label>
          Clé API MuAPI · utilisée depuis ce navigateur uniquement
          <input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="Collez votre clé ici — ne la partagez pas dans le chat" disabled={disabled} />
        </label>
        <label className="remote-prompt">
          Consigne de transformation
          <textarea rows={4} maxLength={2000} value={prompt} onChange={(event) => onPromptChange(event.target.value)} disabled={disabled} />
        </label>
      </div>
      <div className="remote-notice">
        <strong>Avant l’envoi</strong>
        <p>La vérification du devis et du solde a lieu d’abord. Si elle réussit, la vidéo complète — y compris sa piste audio — sera envoyée directement à MuAPI; ses règles de traitement et de conservation s’appliquent. PoseTrace et Vercel ne reçoivent pas la vidéo. Le modèle peut modifier ou supprimer l’audio de sortie.</p>
        <p>Le mode « crédits gratuits seulement » suppose que votre compte MuAPI n’a aucun solde payé ni paiement automatique. Si le devis, le solde ou leurs devises sont illisibles, l’application s’arrête avant l’upload. L’application ne peut pas garantir la politique de facturation interne de MuAPI.</p>
      </div>
      <label className="remote-check">
        <input type="checkbox" checked={uploadConsent} onChange={(event) => onUploadConsentChange(event.target.checked)} disabled={disabled} />
        <span>J’autorise l’envoi de cette vidéo et de son audio à MuAPI pour la génération distante.</span>
      </label>
      <label className="remote-check">
        <input type="checkbox" checked={freeOnlyConfirmed} onChange={(event) => onFreeOnlyConfirmedChange(event.target.checked)} disabled={disabled} />
        <span>Je confirme utiliser un compte limité à ses crédits gratuits, sans paiement automatique ni solde payant.</span>
      </label>
      <button type="button" className="remote-preflight-button" disabled={!canCheckPreflight || checkingPreflight} onClick={onCheckPreflight}>
        {checkingPreflight ? "Vérification du devis et du solde…" : "Vérifier le coût et les crédits — sans envoyer la vidéo"}
      </button>
      {preflight && (
        <div className="remote-estimate" role="status">
          Devis : <strong>{preflight.estimate.amount} {preflight.estimate.currency}</strong>
          <span> · Solde déclaré : {preflight.available.amount} {preflight.available.currency}</span>
        </div>
      )}
    </section>
  );
}
