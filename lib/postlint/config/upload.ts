export const DEFAULT_LOCAL_UPLOAD_MB = 250;
export const DEFAULT_HOSTED_UPLOAD_MB = 4;

export type UploadMode = "local" | "hosted" | "custom";

export type UploadConfig = {
  maxUploadBytes: number;
  maxUploadMb: number;
  mode: UploadMode;
  label: string;
};

type UploadEnvironment = Record<string, string | undefined>;

function positiveMegabytes(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isHostedDemo(environment: UploadEnvironment): boolean {
  return (
    environment.POSTLINT_HOSTED_DEMO === "true" ||
    environment.VERCEL === "1" ||
    environment.NETLIFY === "true"
  );
}

function displayMegabytes(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function resolveUploadConfig(
  environment: UploadEnvironment,
): UploadConfig {
  const configuredMegabytes = positiveMegabytes(
    environment.POSTLINT_MAX_UPLOAD_MB,
  );
  const hosted = isHostedDemo(environment);
  const maxUploadMb =
    configuredMegabytes ??
    (hosted ? DEFAULT_HOSTED_UPLOAD_MB : DEFAULT_LOCAL_UPLOAD_MB);
  const mode: UploadMode = configuredMegabytes
    ? "custom"
    : hosted
      ? "hosted"
      : "local";
  const label =
    hosted && maxUploadMb <= DEFAULT_HOSTED_UPLOAD_MB
      ? `Hackathon demo: videos up to ${displayMegabytes(maxUploadMb)} MB`
      : `${mode === "local" ? "Local analysis" : "Configured limit"}: videos up to ${displayMegabytes(maxUploadMb)} MB`;

  return {
    maxUploadBytes: Math.floor(maxUploadMb * 1024 * 1024),
    maxUploadMb,
    mode,
    label,
  };
}

export function getUploadConfig(): UploadConfig {
  return resolveUploadConfig(process.env);
}

