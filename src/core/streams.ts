import { DEFAULT_RECORDING_LIMITS, type RecordingLimits } from './limits.js';
import type { DisplayCaptureOptions } from '../types.js';

const SURFACE_OPTIONS = {
  audio: false,
  preferCurrentTab: true,
  selfBrowserSurface: 'include',
  surfaceSwitching: 'exclude',
  monitorTypeSurfaces: 'exclude'
} as const;

export function displayConstraints(limits: RecordingLimits): DisplayCaptureOptions {
  return {
    ...SURFACE_OPTIONS,
    video: {
      width: { max: limits.maxWidth },
      height: { max: limits.maxHeight },
      frameRate: { max: limits.maxFrameRate }
    }
  };
}

export async function acquireDisplayStream(
  limits: RecordingLimits = DEFAULT_RECORDING_LIMITS
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia(displayConstraints(limits));
  } catch (cause) {
    if (!isUnsatisfiableConstraint(cause)) throw cause;
    return navigator.mediaDevices.getDisplayMedia({ ...SURFACE_OPTIONS, video: true });
  }
}

function isUnsatisfiableConstraint(cause: unknown): boolean {
  const name = (cause as { name?: string } | null)?.name;
  return name === 'OverconstrainedError' || name === 'NotSupportedError' || name === 'TypeError';
}

export function acquireMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function combineStreams(display: MediaStream, mic?: MediaStream): MediaStream {
  return new MediaStream([...display.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
}

export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
