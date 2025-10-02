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
  const filterRegex = /(\w+):([^\s@]+)/g;
  let match;

  while ((match = filterRegex.exec(cmd)) !== null) {
    const [, filter, optStr] = match;
    if (filter === 'i' || filter === 'o') continue;

    // Check if filter name is valid
    if (!isFilterName(filter)) {
      errors.push({
        type: 'filter',
        filter,
        message: `'${filter}' is not a valid GPAC filter. See 'gpac -ha filters'.`
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

    if (!isMP4BoxFlag(flag)) {
      errors.push({
        type: 'switch',
        switch: match[1],
        message: `Unknown MP4Box switch: ${flag}`,
        suggestion: `Check 'MP4Box -h import/dash/hint'`
      });
    }
  }

  return { valid: errors.length === 0, errors };
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
