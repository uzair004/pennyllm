export interface ValidateOptions {
  config?: string;
  provider?: string[];
  timeout: number;
  json: boolean;
  verbose: boolean;
  dryRun: boolean;
}

export type TestStatus = 'pass' | 'fail' | 'warning' | 'skipped';

export interface KeyTestResult {
  keyIndex: number;
  generateText: { status: TestStatus; latencyMs?: number; message?: string };
  streamText: { status: TestStatus; latencyMs?: number; message?: string };
}

export interface ModelTestResult {
  provider: string;
  providerName: string;
  modelId: string;
  apiModelId: string;
  tier: string;
  free: boolean;
  tested: boolean;
  overallStatus: TestStatus;
  keys: KeyTestResult[];
  message?: string;
}

export interface ValidationResult {
  results: ModelTestResult[];
  summary: {
    totalProviders: number;
    totalKeys: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}
