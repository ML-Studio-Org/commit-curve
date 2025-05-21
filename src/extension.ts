import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import * as childProcess from "child_process";

let activeEditor: vscode.TextEditor | undefined;
let activeSince: number = 0;
let nextServer: childProcess.ChildProcess | undefined;
let panel: vscode.WebviewPanel | undefined;

const timeSpentPerFile: Record<string, number> = {};

export function activate(context: vscode.ExtensionContext) {
  console.log("✅ Commit Curve extension activated");

  activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    activeSince = Date.now();
  }

  // Triggered when editor focus changes
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    trackTime(context);
    activeEditor = editor;
    activeSince = Date.now();
  });

  // Triggered on window blur (e.g., switching apps)
  vscode.window.onDidChangeWindowState((state) => {
    if (!state.focused) {
      trackTime(context);
      activeEditor = undefined;
    } else {
      activeEditor = vscode.window.activeTextEditor;
      activeSince = Date.now();
    }
  });

  context.subscriptions.push({
    dispose: () => {
      trackTime(); // Save data before extension deactivates
      stopNextServer(); // Stop the Next.js server if it's running
    },
  });

  const disposable = vscode.commands.registerCommand(
    "commitCurve.showData",
    async () => {
      const data =
        context.globalState.get<Record<string, number>>("commitCurveData") ||
        {};
      console.log("📊 Commit Curve Data:", data);

      // Start the Next.js server and show the webview
      await showWebView(context, data);
    }
  );

  context.subscriptions.push(disposable);

  const exportDataCommand = vscode.commands.registerCommand(
    "commitCurve.exportData",
    async () => {
      const data =
        context.globalState.get<Record<string, number>>("commitCurveData") ||
        {};
      const fileUri = vscode.Uri.joinPath(
        context.globalStorageUri,
        "activity.json"
      );

      await vscode.workspace.fs.createDirectory(context.globalStorageUri);
      await vscode.workspace.fs.writeFile(
        fileUri,
        Buffer.from(JSON.stringify(data, null, 2), "utf8")
      );

      vscode.window.showInformationMessage(
        `Commit Curve data exported to: ${fileUri.fsPath}`
      );
    }
  );

  context.subscriptions.push(exportDataCommand);
}

// Function to start the Next.js server and show the webview
async function showWebView(
  context: vscode.ExtensionContext,
  data: Record<string, number>
) {
  const extensionPath = context.extensionPath;
  const webAppPath = path.join(extensionPath, "web-app");

  // Check if the Next.js server is already running
  if (!nextServer) {
    try {
      // Show a progress notification while starting the server
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Starting Commit Curve visualization...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Installing dependencies..." });

          // Install dependencies if needed
          if (!fs.existsSync(path.join(webAppPath, "node_modules"))) {
            await new Promise<void>((resolve, reject) => {
              const npmInstall = childProcess.exec("npm install", {
                cwd: webAppPath,
              });

              npmInstall.on("close", (code) => {
                if (code === 0) {
                  resolve();
                } else {
                  reject(new Error(`npm install failed with code ${code}`));
                }
              });
            });
          }

          progress.report({ message: "Starting Next.js server..." });

          // Start the Next.js development server
          nextServer = childProcess.spawn("npm", ["run", "dev"], {
            cwd: webAppPath,
            shell: true,
          });

          // Wait for the server to start
          await new Promise<void>((resolve) => {
            if (nextServer) {
              nextServer.stdout?.on("data", (data) => {
                const output = data.toString();
                if (output.includes("ready") && output.includes("started")) {
                  resolve();
                }
              });
            }

            // Fallback: resolve after 10 seconds if server doesn't report ready
            setTimeout(resolve, 10000);
          });
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to start visualization server: ${error}`
      );
      return;
    }
  }

  // Create and show webview panel
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "commitCurveVisualization",
      "Commit Curve",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(webAppPath)],
      }
    );

    // Handle panel close
    panel.onDidDispose(() => {
      panel = undefined;
    });
  } else {
    // If panel already exists, reveal it
    panel.reveal(vscode.ViewColumn.One);
  }

  // Set the webview content to load from the Next.js server
  panel.webview.html = getWebviewContent();

  // Send data to the webview
  console.log("Sending data to webview:", data);

  // First send immediately
  if (panel) {
    panel.webview.postMessage({
      type: "commitData",
      data: data,
    });
  }

  // Also send after a delay to ensure the page has loaded
  setTimeout(() => {
    if (panel) {
      console.log("Sending data to webview (delayed):", data);
      panel.webview.postMessage({
        type: "commitData",
        data: data,
      });
    }
  }, 3000); // Give the webview time to load
}

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Commit Curve</title>
    <style>
      body, html { margin: 0; padding: 0; height: 100%; }
      iframe { width: 100%; height: 100%; border: none; }
    </style>
  </head>
  <body>
    <iframe src="http://localhost:3000" frameborder="0"></iframe>
    <script>
      // Handle messages from the extension
      window.addEventListener('message', (event) => {
        const message = event.data;
        // Forward the message to the iframe
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(message, '*');
        }
      });
    </script>
  </body>
  </html>`;
}

function stopNextServer() {
  if (nextServer) {
    // On Windows, spawn a process to kill the Node process
    if (process.platform === "win32" && nextServer.pid) {
      childProcess.exec(`taskkill /pid ${nextServer.pid} /T /F`);
    } else if (nextServer.pid) {
      // On Unix-like systems, we can kill the process group
      try {
        process.kill(-nextServer.pid, "SIGKILL");
      } catch (e) {
        // Fallback to normal kill if process group kill fails
        process.kill(nextServer.pid, "SIGKILL");
      }
    }
    nextServer = undefined;
  }
}

async function trackTime(context?: vscode.ExtensionContext) {
  if (!activeEditor || !activeEditor.document) return;

  const fileName = activeEditor.document.fileName;
  const timeSpent = Date.now() - activeSince;

  if (!timeSpentPerFile[fileName]) {
    timeSpentPerFile[fileName] = 0;
  }
  timeSpentPerFile[fileName] += timeSpent;

  // Save to VSCode globalState
  if (context) {
    const existing =
      context.globalState.get<Record<string, number>>("commitCurveData") || {};
    existing[fileName] = (existing[fileName] || 0) + timeSpent;
    await context.globalState.update("commitCurveData", existing);
  }

  console.log(
    `🕒 ${fileName}: ${Math.round(timeSpent / 1000)}s (Total: ${Math.round(
      timeSpentPerFile[fileName] / 1000
    )}s)`
  );
}

export function deactivate() {
  trackTime();
  stopNextServer();
}
