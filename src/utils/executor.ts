import { spawn } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a command in a sandboxed temporary directory
 * Inspired by colleague's runCommand implementation
 */
export async function executeInSandbox(
  command: string,
  workDir?: string
): Promise<ExecutionResult> {
  const tmpDir = workDir || mkdtempSync(join(tmpdir(), "gpac-mcp-"));
  const outPath = join(tmpDir, "stdout.txt");
  const errPath = join(tmpDir, "stderr.txt");
  const shouldCleanup = !workDir;

  return new Promise<ExecutionResult>((resolve, reject) => {
    const shellCommand = `cd "${tmpDir}" && (${command}) >"${outPath}" 2>"${errPath}"`;

    const child = spawn("sh", ["-c", shellCommand], {
      detached: true,
      stdio: "ignore",
    });

    child.on("error", (err) => {
      if (shouldCleanup) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
      reject({ exitCode: 1, stdout: "", stderr: err.message });
    });

    child.on("exit", (code) => {
      let stdout = "";
      let stderr = "";
      try {
        stdout = readFileSync(outPath, "utf-8");
      } catch {}
      try {
        stderr = readFileSync(errPath, "utf-8");
      } catch {}

      if (shouldCleanup) {
        rmSync(tmpDir, { recursive: true, force: true });
      }

      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    child.unref();
  });
}

export function formatSuccessResponse(
  title: string,
  result: ExecutionResult,
  outputType: "text" | "xml" = "text"
): string {
  return `
${title} Result (DO NOT RETRY):

The command completed successfully. Output:

Standard Output:
\`\`\`${outputType}
${result.stdout || "(empty)"}
\`\`\`

Standard Error:
\`\`\`text
${result.stderr || "(none)"}
\`\`\`

Do not retry - command already executed successfully.
`.trim();
}

export function formatErrorResponse(
  title: string,
  result: ExecutionResult | { errors: any[] }
): string {
  if ("errors" in result) {
    return `
${title} Error (DO NOT RETRY):

Validation failed:
${JSON.stringify(result.errors, null, 2)}

Do not retry - fix the command and try again.
`.trim();
  }

  return `
${title} Error (DO NOT RETRY):

Command failed with exit code ${result.exitCode}:

Standard Output:
\`\`\`text
${result.stdout || "(empty)"}
\`\`\`

Standard Error:
\`\`\`text
${result.stderr || "(empty)"}
\`\`\`

Do not retry - fix the issue and try again.
`.trim();
}
