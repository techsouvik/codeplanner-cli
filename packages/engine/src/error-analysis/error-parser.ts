/**
 * Error Parser for CodePlanner Engine
 * 
 * This module provides functionality to parse various types of errors
 * (compiler, runtime, linter) and extract structured information
 * for debugging and analysis purposes.
 */

import type { ParsedError, StackFrame } from '@codeplanner/shared';

/**
 * Error parser for different types of programming errors
 * Extracts structured information from error messages and stack traces
 */
export class ErrorParser {
  
  /**
   * Parses TypeScript compiler errors from error output
   * @param errorOutput - Raw error output from TypeScript compiler
   * @returns Array of parsed error objects
   */
  parseTypeScriptError(errorOutput: string): ParsedError[] {
    const errors: ParsedError[] = [];
    
    // TypeScript error format: file.ts(line,col): error TS####: message
    const tsErrorRegex = /(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s+(.+)/g;
    let match;
    
    while ((match = tsErrorRegex.exec(errorOutput)) !== null) {
      const [, filePath, lineStr, colStr, severity, errorCode, message] = match;
      
      errors.push({
        type: 'compiler',
        filePath: filePath.trim(),
        lineNumber: parseInt(lineStr),
        columnNumber: parseInt(colStr),
        message: message.trim(),
        rawError: match[0],
        // Store additional TypeScript-specific info
        ...(errorCode && { errorCode: `TS${errorCode}` }),
        ...(severity && { severity })
      });
    }
    
    // If no TypeScript errors found, try generic compiler error format
    if (errors.length === 0) {
      const genericErrorRegex = /(.+?)\((\d+),(\d+)\):\s+(error|warning):\s+(.+)/g;
      let genericMatch;
      
      while ((genericMatch = genericErrorRegex.exec(errorOutput)) !== null) {
        const [, filePath, lineStr, colStr, severity, message] = genericMatch;
        
        errors.push({
          type: 'compiler',
          filePath: filePath.trim(),
          lineNumber: parseInt(lineStr),
          columnNumber: parseInt(colStr),
          message: message.trim(),
          rawError: genericMatch[0],
          severity
        });
      }
    }
    
    return errors;
  }

  /**
   * Parses JavaScript runtime errors from stack traces
   * @param stackTrace - Raw stack trace string
   * @returns Parsed error object
   */
  parseRuntimeError(stackTrace: string): ParsedError {
    const lines = stackTrace.split('\n');
    const message = lines[0] || 'Unknown runtime error';
    const frames: StackFrame[] = [];
    
    // Parse stack frames - various formats supported
    const frameRegexes = [
      // Standard format: at functionName (file:line:col)
      /at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/,
      // Alternative format: at file:line:col
      /at\s+(.+?):(\d+):(\d+)/,
      // Node.js internal format
      /at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)\s+\[as\s+(.+?)\]/
    ];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      for (const regex of frameRegexes) {
        const match = regex.exec(line);
        if (match) {
          if (match.length >= 5) {
            // Full format with function name
            frames.push({
              functionName: match[1],
              filePath: match[2],
              lineNumber: parseInt(match[3]),
              columnNumber: parseInt(match[4])
            });
          } else if (match.length >= 4) {
            // Simplified format
            frames.push({
              filePath: match[1],
              lineNumber: parseInt(match[2]),
              columnNumber: parseInt(match[3])
            });
          }
          break;
        }
      }
    }
    
    return {
      type: 'runtime',
      message: message.trim(),
      filePath: frames[0]?.filePath,
      lineNumber: frames[0]?.lineNumber,
      columnNumber: frames[0]?.columnNumber,
      stackTrace: frames,
      rawError: stackTrace
    };
  }

  /**
   * Parses linter errors (ESLint, etc.)
   * @param linterOutput - Raw linter output
   * @returns Array of parsed error objects
   */
  parseLinterError(linterOutput: string): ParsedError[] {
    const errors: ParsedError[] = [];
    
    // ESLint format: file:line:col: level message (rule)
    const eslintRegex = /(.+?):(\d+):(\d+):\s+(error|warning|info)\s+(.+?)\s+\((.+?)\)/g;
    let match;
    
    while ((match = eslintRegex.exec(linterOutput)) !== null) {
      const [, filePath, lineStr, colStr, level, message, rule] = match;
      
      errors.push({
        type: 'linter',
        filePath: filePath.trim(),
        lineNumber: parseInt(lineStr),
        columnNumber: parseInt(colStr),
        message: message.trim(),
        rawError: match[0],
        severity: level,
        rule
      });
    }
    
    return errors;
  }

  /**
   * Parses generic error messages and attempts to extract structure
   * @param errorMessage - Generic error message
   * @returns Parsed error object
   */
  parseGenericError(errorMessage: string): ParsedError {
    // Try to extract file path and line number from common patterns
    const patterns = [
      // Pattern: "Error in file.ts:123: message"
      /Error in (.+?):(\d+):\s*(.+)/,
      // Pattern: "file.ts:123: message"
      /(.+?):(\d+):\s*(.+)/,
      // Pattern: "message (file.ts:123)"
      /(.+?)\s+\((.+?):(\d+)\)/
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(errorMessage);
      if (match) {
        return {
          type: 'runtime',
          message: match[3] || match[1] || errorMessage,
          filePath: match[1] || match[2],
          lineNumber: parseInt(match[2] || match[3]),
          rawError: errorMessage
        };
      }
    }
    
    // If no pattern matches, return as generic runtime error
    return {
      type: 'runtime',
      message: errorMessage,
      rawError: errorMessage
    };
  }

  /**
   * Automatically detects error type and parses accordingly
   * @param errorInput - Raw error input
   * @returns Parsed error object(s)
   */
  parseError(errorInput: string): ParsedError | ParsedError[] {
    const input = errorInput.trim();
    
    // Detect TypeScript compiler errors
    if (input.includes('error TS') || input.includes('warning TS')) {
      return this.parseTypeScriptError(input);
    }
    
    // Detect linter errors
    if (input.includes('eslint') || input.match(/:\d+:\d+:\s+(error|warning|info)/)) {
      return this.parseLinterError(input);
    }
    
    // Detect runtime errors (stack traces)
    if (input.includes('at ') && input.includes(':')) {
      return this.parseRuntimeError(input);
    }
    
    // Fall back to generic parsing
    return this.parseGenericError(input);
  }

  /**
   * Extracts error context from parsed error
   * @param error - Parsed error object
   * @returns Context information
   */
  getErrorContext(error: ParsedError): {
    category: string;
    severity: string;
    location: string;
    suggestion: string;
  } {
    let category = 'Unknown';
    let severity = 'error';
    let location = 'Unknown location';
    let suggestion = 'Review the error message and check the code.';
    
    // Determine category based on error type and message
    if (error.type === 'compiler') {
      category = 'Compilation Error';
      severity = 'error';
      
      if (error.message.includes('Property') && error.message.includes('does not exist')) {
        category = 'Type Error';
        suggestion = 'Check if the property exists on the object type or if you need to add it.';
      } else if (error.message.includes('Cannot find module')) {
        category = 'Import Error';
        suggestion = 'Check if the module path is correct and the module is installed.';
      } else if (error.message.includes('Expected')) {
        category = 'Syntax Error';
        suggestion = 'Check the syntax around the indicated location.';
      }
    } else if (error.type === 'runtime') {
      category = 'Runtime Error';
      severity = 'error';
      
      if (error.message.includes('Cannot read property') || error.message.includes('Cannot read properties')) {
        category = 'Null/Undefined Error';
        suggestion = 'Check if the object is null or undefined before accessing its properties.';
      } else if (error.message.includes('is not a function')) {
        category = 'Type Error';
        suggestion = 'Check if the variable is actually a function or if there\'s a typo in the function name.';
      }
    } else if (error.type === 'linter') {
      category = 'Linting Error';
      severity = 'warning';
      suggestion = 'Follow the linting rule or configure it if needed.';
    }
    
    // Build location string
    if (error.filePath && error.lineNumber) {
      location = `${error.filePath}:${error.lineNumber}`;
      if (error.columnNumber) {
        location += `:${error.columnNumber}`;
      }
    } else if (error.filePath) {
      location = error.filePath;
    }
    
    return { category, severity, location, suggestion };
  }

  /**
   * Groups related errors together
   * @param errors - Array of parsed errors
   * @returns Grouped errors by file and type
   */
  groupErrors(errors: ParsedError[]): Record<string, ParsedError[]> {
    const groups: Record<string, ParsedError[]> = {};
    
    for (const error of errors) {
      const key = `${error.type}:${error.filePath || 'unknown'}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(error);
    }
    
    return groups;
  }
}
