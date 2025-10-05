import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  cwd: string;
  terminalId: number;
}

export default function Terminal({ cwd, terminalId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"SF Mono", Monaco, Menlo, Consolas, monospace',
      theme: {
        background: "#282c34",
        foreground: "#abb2bf",
        cursor: "#528bff",
        cursorAccent: "#282c34",
        selectionBackground: "#3e4451",
        black: "#282c34",
        red: "#e06c75",
        green: "#98c379",
        yellow: "#e5c07b",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#abb2bf",
        brightBlack: "#5c6370",
        brightRed: "#e06c75",
        brightGreen: "#98c379",
        brightYellow: "#e5c07b",
        brightBlue: "#61afef",
        brightMagenta: "#c678dd",
        brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
      scrollback: 1000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    let currentLine = "";
    xterm.write("$ ");

    xterm.onData(async (data) => {
      if (data === "\r") {
        // Enter pressed
        xterm.write("\r\n");
        if (currentLine.trim()) {
          try {
            const parts = currentLine.trim().split(" ");
            const command = parts[0];
            const args = parts.slice(1);

            const result = await invoke<string>("execute_command", {
              command,
              args,
              cwd,
            });

            // Properly handle newlines in output
            const lines = result.split('\n');
            lines.forEach((line, idx) => {
              xterm.write(line);
              if (idx < lines.length - 1) {
                xterm.write('\r\n');
              }
            });

            if (!result.endsWith('\n')) {
              xterm.write('\r\n');
            }
          } catch (error) {
            xterm.write(`\x1b[31mError: ${error}\x1b[0m\r\n`);
          }
        }
        currentLine = "";
        xterm.write("$ ");
      } else if (data === "\x7F") {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          xterm.write("\b \b");
        }
      } else if (data === "\x03") {
        // Ctrl+C
        xterm.write("^C\r\n$ ");
        currentLine = "";
      } else {
        currentLine += data;
        xterm.write(data);
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      xterm.dispose();
    };
  }, [cwd, terminalId]);

  return <div ref={terminalRef} style={{ height: "100%", width: "100%", padding: "8px" }} />;
}
