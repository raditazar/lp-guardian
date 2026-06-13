// Server-side mirror of the frontend's PublicReport / AssembledReportPayload
// contract (apps/web/src/hooks/useReport.ts). Kept in sync so /api/report/:hash
// renders without transformation.

export interface AssembledReportPayload {
  schemaVersion: number;
  generatedAt: string;
  agent: { name: string; version: string };
  position: {
    tokenId: string;
    version: 3 | 4;
    pair: string;
    owner: string;
  };
  attestation?: {
    type: "0g-compute-broker-signature";
    provider: string;
    model: string;
    requestSignatureHash?: string;
    brokerLedgerTx?: string;
    generatedAt: string;
    stub: boolean;
  };
  il?: {
    hodlValueT1: number;
    lpValueT1: number;
    feesValueT1: number;
    ilT1: number;
    ilPct: number;
  };
  regime?: { topLabel: string; confidence: number; narrative: string };
  hooks?: { pair: string; topFamily: string; candidateCount: number };
  migration?: {
    targetHookAddress?: string;
    targetFamily?: string;
    priceImpactPct?: number;
    warnings: string[];
  };
  strategistAdvice?: {
    recommendation: string;
    rationale: string;
    confidence: number;
    attestationLabel: string;
    source: {
      provider: string;
      label: string;
      modelProvider?: string;
      modelName?: string;
      actionName?: string;
    };
  };
}

export interface PublicReport {
  rootHash: string;
  storageUrl: string;
  anchorTxHash?: string;
  anchorChainId?: number;
  storageStub: boolean;
  anchorStub?: boolean;
  cachedAt: string;
  payload: AssembledReportPayload;
}
