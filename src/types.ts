export interface FeedbackMeta {
  url: string;
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  timestamp: string;
}

export interface FeedbackRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

export type FeedbackType = 'annotation' | 'video';

export interface FeedbackSubmitDetail {
  type: FeedbackType;
  screenshot?: Blob;
  annotatedImage?: Blob;
  region?: FeedbackRegion;
  description?: string;
  audio?: Blob;
  video?: Blob;
  meta: FeedbackMeta;
}

export type FeedbackErrorStage = 'capture' | 'audio' | 'video';

export interface FeedbackErrorDetail {
  stage: FeedbackErrorStage;
  message: string;
  cause?: unknown;
}

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface DisplayCaptureOptions extends DisplayMediaStreamOptions {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  monitorTypeSurfaces?: 'include' | 'exclude';
}

declare global {
  interface GlobalEventHandlersEventMap {
    'feedback-open': CustomEvent<void>;
    'feedback-close': CustomEvent<void>;
    'feedback-submit': CustomEvent<FeedbackSubmitDetail>;
    'feedback-error': CustomEvent<FeedbackErrorDetail>;
  }
}
