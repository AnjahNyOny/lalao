import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/caveat/700.css';
import '@fontsource/patrick-hand/400.css';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { arcadeTheme } from './theme/arcade';
import { applyTheme } from './theme/theme';

// Before the first paint, so the menu never flashes unstyled.
applyTheme(arcadeTheme);

// Browsers fetch a font on first use. Get every game's fonts now, so a game
// started after the connection drops (solo, local play) still looks right.
const FONTS = ["700 1em 'Caveat'", "1em 'Patrick Hand'", "1em 'Press Start 2P'", "1em 'VT323'", "500 1em 'Baloo 2'", "700 1em 'Baloo 2'", "800 1em 'Baloo 2'"];
for (const font of FONTS) {
  document.fonts.load(font).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
