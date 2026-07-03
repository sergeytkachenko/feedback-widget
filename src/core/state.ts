export type WidgetState =
  | 'idle'
  | 'menu'
  | 'selecting'
  | 'capturing'
  | 'editing'
  | 'recording'
  | 'video-preview';

export const TRANSITIONS: Record<WidgetState, readonly WidgetState[]> = {
  idle: ['menu'],
  menu: ['idle', 'selecting', 'recording'],
  selecting: ['capturing', 'idle'],
  capturing: ['editing', 'idle'],
  editing: ['idle'],
  recording: ['video-preview', 'idle'],
  'video-preview': ['idle']
};

export function canTransition(from: WidgetState, to: WidgetState): boolean {
  return TRANSITIONS[from].includes(to);
}
