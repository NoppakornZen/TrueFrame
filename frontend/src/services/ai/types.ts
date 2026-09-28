// Shared types for the optional AI vision layer.
// The app is fully functional without any of this — see config.ts.

export interface AiConfig {
  provider: 'openai' | 'anthropic';
  /** e.g. https://gw.example.com/v1 (openai) or https://gw.example.com (anthropic) */
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

/** What the AI said about the condition of the part in one photo. */
export interface PhotoConditionAnalysis {
  damage: boolean;
  corrosion: boolean;
  tamperingSigns: boolean;
  /** null = the seal is not visible in frame — never guess. */
  sealIntact: boolean | null;
  packagingDamaged: boolean | null;
  /** Serial/lot number legible on the part itself, if any. */
  visibleSerial?: string;
  /** Part number legible on the part itself, if any. */
  visiblePartNumber?: string;
  /** 2-5 short, factual sentences. */
  findings: string[];
  /** Model self-report, 0..1. */
  aiConfidence: number;
}

export type AiErrorKind = 'not_configured' | 'network' | 'timeout' | 'http' | 'parse';

export class AiError extends Error {
  constructor(
    message: string,
    public readonly kind: AiErrorKind
  ) {
    super(message);
    this.name = 'AiError';
  }
}
