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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
