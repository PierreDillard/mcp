/** Static GPAC command validation - no media execution */

import { execSync } from "child_process";
import { isFilterName, findOptionInFilters } from "./gpac-docs.js";
import { isMP4BoxCommand, isMP4BoxFlag } from "./mp4box-docs.js";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

export interface ValidationError {
  type: 'filter' | 'option' | 'switch';
  filter?: string;
  option?: string;
  switch?: string;
  message: string;
  suggestion?: string;
}

export function validateGpacCommand(cmd: string): ValidationResult {
  return isMP4BoxCommand(cmd) ? validateMP4Box(cmd) : validateGpacFilters(cmd);
}

function validateGpacFilters(cmd: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Remove input/output file paths to avoid validating file extensions as filters
  // Patterns: -i path, -o path, -src path
  const cleanedCmd = cmd.replace(/\s+-[io]\s+[^\s]+/g, ' ')
                        .replace(/\s+-src\s+[^\s]+/g, ' ');

  const filterRegex = /(\w+):([^\s@]+)/g;
  let match;

  while ((match = filterRegex.exec(cleanedCmd)) !== null) {
    const [, filter, optStr] = match;

    // Skip common file extensions that might be captured
    if (['mp4', 'mpd', 'aac', 'm4a', 'mp3', 'ts', 'mkv', 'avi', 'mov', 'hevc', 'h264', 'avc'].includes(filter.toLowerCase())) {
      continue;
    }

    // Check if filter name is valid (dynamically with gpac -h)
    const filterCheck = checkFilterName(filter);
    if (!filterCheck.valid) {
      errors.push({
        type: 'filter',
        filter,
        message: filterCheck.message
      });
      continue;
    }

    // Check each option
    optStr.split(':').forEach(opt => {
      const [name] = opt.split('=');
      if (!name) return;

      const check = checkOption(filter, name);
      if (!check.valid) {
        // Try to find which filters have this option
        const alternatives = findOptionInFilters(name);
        const suggestion = alternatives.length > 0
          ? `Option '${name}' exists in: ${alternatives.map(a => a.filter).join(', ')}`
          : check.suggestion;

        errors.push({
          type: 'option',
          filter,
          option: name,
          message: check.message,
          suggestion
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function checkFilterName(filter: string): {valid:boolean; message:string} {
  // First check the index (fast path)
  if (isFilterName(filter)) {
    return {valid:true, message:'OK'};
  }

  // Fallback: query gpac -h <filter> directly
  try {
    const out = execSync(`gpac -h ${filter}`, {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore','pipe','pipe'],
      env: { ...process.env, LANG: "C", LC_ALL: "C" }
    });

    // If help is returned and doesn't say "not found", filter exists
    if (out && !out.toLowerCase().includes('not found')) {
      return {valid:true, message:'OK'};
    }
  } catch (e: any) {
    // gpac -h <filter> failed
  }

  return {
    valid: false,
    message: `'${filter}' is not a valid GPAC filter. Try 'gpac -h ${filter}' or 'gpac -ha filters'.`
  };
}

function validateMP4Box(cmd: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Prevent filter:option syntax in MP4Box commands
  if (cmd.match(/\w+:\w+=/)) {
    errors.push({
      type: 'switch',
      message: 'MP4Box does not use filter:option syntax. Use MP4Box flags instead.'
    });
  }

  // Check switches (avoiding filename false positives)
  const switchRegex = /\s-([a-z][a-z-]*)/g;
  let match;

  while ((match = switchRegex.exec(cmd)) !== null) {
    const flag = `-${match[1]}`;

    // Check dynamically with MP4Box -h
    const check = checkMP4BoxFlag(flag);
    if (!check.valid) {
      errors.push({
        type: 'switch',
        switch: match[1],
        message: check.message,
        suggestion: check.suggestion
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkMP4BoxFlag(flag: string): {valid:boolean; message:string; suggestion?:string} {
  // First check the index (fast path)
  if (isMP4BoxFlag(flag)) {
    return {valid:true, message:'OK'};
  }

  // Fallback: query MP4Box -h <flag> directly
  try {
    const out = execSync(`MP4Box -h ${flag.slice(1)}`, {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore','pipe','pipe'],
      env: { ...process.env, LANG: "C", LC_ALL: "C" }
    });

    // If help is returned, the flag exists
    if (out && !out.toLowerCase().includes('unknown option')) {
      return {valid:true, message:'OK'};
    }
  } catch (e: any) {
    // MP4Box -h <flag> failed, flag probably doesn't exist
  }

  return {
    valid: false,
    message: `Unknown MP4Box switch: ${flag}`,
    suggestion: `Try 'MP4Box -h ${flag.slice(1)}' or 'MP4Box -h import/dash/hint'`
  };
}

function checkOption(filter: string, opt: string): {valid:boolean; message:string; suggestion?:string} {
  try {
    const out = execSync(`gpac -h ${filter}.${opt}`, {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore','pipe','pipe'],
      env: { ...process.env, LANG: "C", LC_ALL: "C" }
    });
    if (!out.toLowerCase().includes('not found')) return {valid:true, message:'OK'};
  } catch (e: any) {
    const sugg = e.stderr?.match(/closest match[es]*:\s*([^\n]+)/i)?.[1]?.trim();
    return {valid:false, message:`${filter}.${opt} not found`, suggestion:sugg};
  }
  return {valid:false, message:`Failed to validate ${filter}.${opt}`};
}
