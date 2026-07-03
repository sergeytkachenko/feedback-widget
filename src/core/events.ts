import type { FeedbackErrorDetail } from '../types.js';
import type { Rect } from './region.js';

export const FeedbackEvents = {
  open: 'feedback-open',
  close: 'feedback-close',
  submit: 'feedback-submit',
  error: 'feedback-error'
} as const;

export type FeedbackEventName = (typeof FeedbackEvents)[keyof typeof FeedbackEvents];

export const InternalEvents = {
  mode: 'fw-mode',
  dismiss: 'fw-dismiss',
  region: 'fw-region',
  cancel: 'fw-cancel',
  editorSubmit: 'fw-editor-submit',
  audio: 'fw-audio',
  audioClear: 'fw-audio-clear',
  recorded: 'fw-recorded',
  previewSubmit: 'fw-preview-submit',
  error: 'fw-error'
} as const;

export interface ModeDetail {
  mode: 'annotate' | 'video';
  mic: boolean;
}

export interface RegionDetail {
  rect: Rect;
}

export interface EditorSubmitDetail {
  annotatedImage: Blob;
  description: string;
  audio?: Blob;
}

export interface AudioDetail {
  blob: Blob;
}

export interface RecordedDetail {
  video: Blob;
}

export interface PreviewSubmitDetail {
  description: string;
}

export type InternalErrorDetail = FeedbackErrorDetail;

export function emitPublic<T>(host: EventTarget, name: FeedbackEventName, detail?: T): void {
  host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

export function emitInternal<T>(el: EventTarget, name: string, detail?: T): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: false }));
}
