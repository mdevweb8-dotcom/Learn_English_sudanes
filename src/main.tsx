import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSpeechEngine } from './utils/speech.ts';

// Pre-initialize speech synthesis engine on app launch (not on first click)
initSpeechEngine();

createRoot(document.getElementById('root')!).render(<App />);
