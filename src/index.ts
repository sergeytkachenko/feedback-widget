import { FeedbackWidget } from './feedback-widget.js';

if (!customElements.get('feedback-widget')) customElements.define('feedback-widget', FeedbackWidget);

export { FeedbackWidget };
export { FeedbackEvents } from './core/events.js';
export type { CaptureEngine } from './core/capture.js';
export { DEFAULT_RECORDING_LIMITS } from './core/limits.js';
export type { RecordingLimits } from './core/limits.js';
export type {
  FeedbackErrorDetail,
  FeedbackErrorStage,
  FeedbackMeta,
  FeedbackRegion,
  FeedbackSubmitDetail,
  FeedbackType,
  WidgetPosition
} from './types.js';
