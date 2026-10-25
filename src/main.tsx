import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

async function bootstrap() {
  // Vite replaces MODE at build time; production bundles omit the fixture.
  if (import.meta.env.MODE === 'integration') {
    const { installTelegramMock } = await import('../tests/browser/telegramMock');
    installTelegramMock();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
