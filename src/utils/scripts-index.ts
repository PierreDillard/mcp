import { readFileSync } from "fs";
import { glob } from "glob";

interface ScriptIndex {
  files: string[];
  content: Map<string, string>;
}

const scriptIndex: ScriptIndex = {
  files: [],
  content: new Map()
};

export async function loadScripts(scriptsDir: string): Promise<number> {
  try {
    const pattern = `${scriptsDir}/**/*.sh`;
    const files = await glob(pattern);
    
    scriptIndex.files = files;
    
    // Load content for search capabilities
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        scriptIndex.content.set(file, content);
      } catch (error) {
        console.error(`Failed to load script ${file}:`, error);
      }
    }
    
    return files.length;
  } catch (error) {
    console.error('Failed to load scripts:', error);
    return 0;
  }
}

export function listScriptFiles(): string[] {
  return scriptIndex.files;
}

export async function searchScripts(query: string, context: number = 3): Promise<any[]> {
  const results: any[] = [];
  const queryRegex = new RegExp(query, 'gi');
  
  for (const [filePath, content] of scriptIndex.content.entries()) {
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (queryRegex.test(line)) {
        const startLine = Math.max(0, lineIndex - context);
        const endLine = Math.min(lines.length - 1, lineIndex + context);
        
        results.push({
          file: filePath,
          line: lineIndex + 1,
          match: line.trim(),
          context: lines.slice(startLine, endLine + 1).map((l, i) => ({
            line: startLine + i + 1,
            content: l
          }))
        });
      }
    });
  }
  
  return results;
}

export async function readScriptSegment(path: string, startLine: number, endLine: number): Promise<string> {
  try {
    const content = scriptIndex.content.get(path);
    if (!content) {
      throw new Error(`Script not found: ${path}`);
    }
    
    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    
    return lines.slice(start, end).join('\n');
  } catch (error) {
    throw new Error(`Failed to read script segment: ${error}`);
  }
}