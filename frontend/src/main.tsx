import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { createAppRouter, registerUnauthorizedNavigation } from './router.tsx';

const router = createAppRouter();
registerUnauthorizedNavigation(router);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App router={router} />
  </StrictMode>,
);
