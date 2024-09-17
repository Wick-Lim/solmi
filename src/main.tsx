import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";

import App from "./App";
import theme from "./theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{
        'html, body, #root': {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }
      }} />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
