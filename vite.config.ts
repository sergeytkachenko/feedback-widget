import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  if (mode === 'cdn') {
    return {
      build: {
        emptyOutDir: false,
        lib: {
          entry: 'src/index.ts',
          name: 'FeedbackWidget',
          formats: ['iife'],
          fileName: () => 'feedback-widget.iife.js'
        }
      }
    };
  }
  if (mode === 'es') {
    return {
      plugins: [dts({ rollupTypes: true, tsconfigPath: './tsconfig.json' })],
      build: {
        lib: {
          entry: 'src/index.ts',
          formats: ['es'],
          fileName: () => 'feedback-widget.js'
        },
        rollupOptions: {
          external: [/^lit(\/|$)/, /^@lit(\/|$)/, '@zumer/snapdom']
        }
      }
    };
  }
  return {};
});
