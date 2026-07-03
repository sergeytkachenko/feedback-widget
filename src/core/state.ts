export type WidgetState =
  | 'idle'
  | 'menu'
  | 'capturing'
  | 'selecting'
  | 'editing'
  | 'recording'
  | 'video-preview';

export const TRANSITIONS: Record<WidgetState, readonly WidgetState[]> = {
  idle: ['menu'],
  menu: ['idle', 'capturing', 'recording'],
  capturing: ['selecting', 'idle'],
  selecting: ['editing', 'idle'],
  editing: ['idle'],
  recording: ['video-preview', 'idle'],
  'video-preview': ['idle']
};

export function canTransition(from: WidgetState, to: WidgetState): boolean {
  return TRANSITIONS[from].includes(to);
}
