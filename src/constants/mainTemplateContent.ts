const MAIN_FILE_CONTENT = `
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client'; 
~~react-router-import~~
~~mui-import~~
~~mui-theme-import~~

import App from './App'; 
import './index.css';

createRoot(document.getElementById('root')~~main-ts-non-null~~).render(
  <StrictMode>
    ~~mui-open-tag~~
      ~~router-open-tag~~
        <App />
      ~~router-close-tag~~
    ~~mui-close-tag~~
  </StrictMode>
);
`;

export default MAIN_FILE_CONTENT;
