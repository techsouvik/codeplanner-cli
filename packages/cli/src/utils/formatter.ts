/**
 * Output formatting utilities for CodePlanner CLI
 * 
 * This module provides formatting functions for displaying
 * plans, errors, and other output in a user-friendly format.
 */

/**
 * Formats a plan step for display in the terminal
 * @param step - The plan step to format
 * @returns Formatted string representation
 */
export function formatPlanStep(step: any): string {
  const { stepNumber, action, description, filePath, codeChange } = step;
  
  let output = `\n${stepNumber}. ${action}`;
  
  if (filePath) {
    output += ` (${filePath})`;
  }
  
  output += `\n   ${description}`;
  
  if (codeChange) {
    output += `\n\n   Before:\n   ${codeChange.before}`;
    output += `\n\n   After:\n   ${codeChange.after}`;
  }
  
  return output;
}

/**
 * Formats an error message for display
 * @param error - Error object or message
 * @returns Formatted error string
 */
export function formatError(error: any): string {
  if (typeof error === 'string') {
    return `❌ ${error}`;
  }
  
  if (error.message) {
    return `❌ ${error.message}`;
  }
  
  return `❌ ${JSON.stringify(error)}`;
}

/**
 * Formats a success message for display
 * @param message - Success message
 * @returns Formatted success string
 */
export function formatSuccess(message: string): string {
  return `✅ ${message}`;
}

/**
 * Formats a warning message for display
 * @param message - Warning message
 * @returns Formatted warning string
 */
export function formatWarning(message: string): string {
  return `⚠️  ${message}`;
}

/**
 * Formats a progress indicator
 * @param current - Current progress value
 * @param total - Total progress value
 * @param label - Progress label
 * @returns Formatted progress string
 */
export function formatProgress(current: number, total: number, label: string): string {
  const percentage = Math.round((current / total) * 100);
  const barLength = 20;
  const filledLength = Math.round((current / total) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  return `\r${label}: [${bar}] ${percentage}% (${current}/${total})`;
}

/**
 * Clears the current line in the terminal
 */
export function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

/**
 * Formats file paths for display (truncates if too long)
 * @param filePath - File path to format
 * @param maxLength - Maximum length before truncation
 * @returns Formatted file path
 */
export function formatFilePath(filePath: string, maxLength: number = 50): string {
  if (filePath.length <= maxLength) {
    return filePath;
  }
  
  const start = filePath.substring(0, 20);
  const end = filePath.substring(filePath.length - 27);
  return `${start}...${end}`;
}
