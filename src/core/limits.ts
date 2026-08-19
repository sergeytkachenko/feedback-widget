export interface RecordingLimits {
  maxDurationSec: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  maxWidth: number;
  maxHeight: number;
  maxFrameRate: number;
}

export const DEFAULT_RECORDING_LIMITS: RecordingLimits = {
  maxDurationSec: 600,
  videoBitsPerSecond: 1_200_000,
  audioBitsPerSecond: 64_000,
  maxWidth: 1920,
  maxHeight: 1080,
  maxFrameRate: 24
};

export const LAST_CALL_SEC = 30;

export function estimateRecordingBytes(limits: RecordingLimits, seconds: number): number {
  return Math.round(((limits.videoBitsPerSecond + limits.audioBitsPerSecond) / 8) * seconds);
}
