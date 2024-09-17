import { createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
  components: {
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: "32px",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          padding: "0 8px",
          minHeight: "32px",
          textTransform: "unset",
        },
      },
    },
  },
});

export default theme;
