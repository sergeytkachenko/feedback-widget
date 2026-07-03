import type { FeedbackMeta, FeedbackRegion, FeedbackSubmitDetail, FeedbackType } from '../types.js';

export interface SessionArtifacts {
  region?: FeedbackRegion;
  screenshot?: Blob;
  annotatedImage?: Blob;
  description?: string;
  audio?: Blob;
  video?: Blob;
}

export interface MetaSource {
  location: { href: string };
  navigator: { userAgent: string };
  innerWidth: number;
  innerHeight: number;
}

export function buildMeta(source: MetaSource): FeedbackMeta {
  return {
    url: source.location.href,
    userAgent: source.navigator.userAgent,
    viewportWidth: source.innerWidth,
    viewportHeight: source.innerHeight,
    timestamp: new Date().toISOString()
  };
}

export function buildSubmitDetail(type: FeedbackType, session: SessionArtifacts, meta: FeedbackMeta): FeedbackSubmitDetail {
  const detail: FeedbackSubmitDetail = { type, meta };
  if (session.screenshot) detail.screenshot = session.screenshot;
  if (session.annotatedImage) detail.annotatedImage = session.annotatedImage;
  if (session.region) detail.region = session.region;
  if (session.description) detail.description = session.description;
  if (session.audio) detail.audio = session.audio;
  if (session.video) detail.video = session.video;
  return detail;
}
