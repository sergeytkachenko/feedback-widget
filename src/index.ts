import { FeedbackWidget } from './feedback-widget.js';

if (!customElements.get('feedback-widget')) customElements.define('feedback-widget', FeedbackWidget);

export { FeedbackWidget };
export { FeedbackEvents } from './core/events.js';
export type {
  FeedbackErrorDetail,
  FeedbackErrorStage,
  FeedbackMeta,
  FeedbackRegion,
  FeedbackSubmitDetail,
  FeedbackType,
  WidgetPosition
} from './types.js';
