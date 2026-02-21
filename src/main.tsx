import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import { setupIonicReact } from '@ionic/react';

setupIonicReact({ mode: 'md' });

createRoot(document.getElementById("root")!).render(<App />);
