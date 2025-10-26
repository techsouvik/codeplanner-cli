/**
 * Debugger for CodePlanner Engine
 * 
 * This module provides AI-powered debugging capabilities that analyze
 * errors and generate step-by-step debugging plans with specific fixes.
 */

import OpenAI from 'openai';
import { ASTParser } from '../parser/ast-parser';
import type { ParsedError, CodeChunk, DebuggingPlan, DebuggingStep } from '@codeplanner/shared';
import type { PlanGeneratorConfig } from '../types';

/**
 * AI-powered debugger that analyzes errors and generates debugging plans
 * Uses LLM to understand error context and provide actionable solutions
 */
export class Debugger {
  private openai: OpenAI;
  private parser: ASTParser;
  private config: PlanGeneratorConfig;

  constructor(
    config: PlanGeneratorConfig,
    parser: ASTParser
  ) {
    this.config = {
      model: 'gpt-4-turbo-preview',
      temperature: 0.2,
      ...config
    };
    
    this.openai = new OpenAI({ 
      apiKey: config.apiKey 
    });
    this.parser = parser;
  }

  /**
   * Analyzes an error and generates a debugging plan
   * @param error - Parsed error object
   * @param relevantCode - Array of relevant code chunks from semantic search
   * @returns Async generator that yields debugging plan content
   */
  async analyzeError(
    error: ParsedError,
    relevantCode: CodeChunk[]
  ): Promise<AsyncGenerator<string>> {
    try {
      // Get file context around the error location
      const fileContext = await this.getFileContext(error);
      
      // Build the debugging prompt
      const prompt = this.buildDebugPrompt(error, fileContext, relevantCode);
      
      console.log(`🐛 Analyzing ${error.type} error: ${error.message}`);
      console.log(`📊 Using ${relevantCode.length} relevant code chunks as context`);
      
      // Create the streaming completion
      const stream = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true,
        temperature: this.config.temperature,
        max_tokens: 4000
      });

      // Return the streaming response
      return this.streamResponse(stream);
      
    } catch (error) {
      console.error('❌ Failed to analyze error:', error);
      throw new Error(`Error analysis failed: ${error}`);
    }
  }

  /**
   * Gets file context around the error location
   * @param error - Parsed error object
   * @returns File context string
   */
  private async getFileContext(error: ParsedError): Promise<string> {
    if (!error.filePath || !error.lineNumber) {
      return 'No file context available.';
    }

    try {
      const content = this.parser.getFileContext(error.filePath, error.lineNumber, 15);
      if (!content) {
        return 'Could not read file content.';
      }

      const lines = content.split('\n');
      const errorLineIndex = lines.findIndex((line, index) => {
        // Find the line that corresponds to the error line number
        return index === Math.floor(lines.length / 2); // Approximate error line position
      });

      return lines.map((line, index) => {
        const lineNum = error.lineNumber! - Math.floor(lines.length / 2) + index + 1;
        const marker = index === errorLineIndex ? '→ ' : '  ';
        return `${marker}${lineNum}: ${line}`;
      }).join('\n');
      
    } catch (error) {
      console.warn('⚠️  Failed to get file context:', error);
      return 'Could not read file context.';
    }
  }

  /**
   * Builds the debugging prompt for the LLM
   * @param error - Parsed error object
   * @param fileContext - File context around error location
   * @param relevantCode - Relevant code chunks
   * @returns Complete debugging prompt
   */
  private buildDebugPrompt(
    error: ParsedError,
    fileContext: string,
    relevantCode: CodeChunk[]
  ): string {
    const context = relevantCode.map((chunk, index) => `
## Related Code ${index + 1}
**File:** \`${chunk.filePath}\`
**Type:** ${chunk.type}
${chunk.name ? `**Name:** \`${chunk.name}\`` : ''}
${'similarity' in chunk ? `**Relevance:** ${((chunk as any).similarity * 100).toFixed(1)}%` : ''}

\`\`\`typescript
${chunk.content}
\`\`\`
`).join('\n');

    return `# Error Analysis and Debugging Request

## Error Details
- **Type:** ${error.type}
- **Message:** ${error.message}
- **Location:** ${error.filePath || 'Unknown'}:${error.lineNumber || 'Unknown'}
${error.columnNumber ? `- **Column:** ${error.columnNumber}` : ''}
${error.errorCode ? `- **Error Code:** ${error.errorCode}` : ''}

${error.stackTrace ? `## Stack Trace
${error.stackTrace.map(frame => 
  `  at ${frame.functionName || '<anonymous>'} (${frame.filePath}:${frame.lineNumber}:${frame.columnNumber})`
).join('\n')}` : ''}

## File Context
\`\`\`typescript
${fileContext}
\`\`\`

## Related Code
${context}

## Task
Analyze this error and provide a comprehensive debugging plan that includes:

1. **Root Cause Analysis**: What is causing this error?
2. **Immediate Fix**: Step-by-step instructions to resolve the error
3. **Code Changes**: Specific before/after code examples
4. **Prevention**: How to avoid similar errors in the future
5. **Testing**: How to verify the fix works

## Format Requirements
- Use clear Markdown formatting with headers and code blocks
- Number all debugging steps
- Include specific file paths and line numbers
- Provide concrete code examples with before/after comparisons
- Explain the reasoning behind each fix
- Consider edge cases and potential side effects

## Context Notes
- The file context shows the code around the error location
- The related code shows similar patterns in the codebase
- Use existing code patterns and conventions when suggesting fixes
- Consider the overall architecture and design principles

Generate a debugging plan that a developer can follow to quickly identify and fix the issue.`;
  }

  /**
   * Gets the system prompt for the debugging LLM
   * @returns System prompt string
   */
  private getSystemPrompt(): string {
    return `You are an expert debugging specialist with deep experience in:

- TypeScript/JavaScript error analysis
- Common programming pitfalls and their solutions
- Code review and debugging methodologies
- Testing and validation strategies
- Performance optimization and best practices

Your role is to analyze errors and provide clear, actionable debugging plans that help developers quickly identify and resolve issues.

Key principles:
- Always identify the root cause, not just symptoms
- Provide specific, implementable solutions
- Include code examples with before/after comparisons
- Consider the broader codebase context
- Suggest prevention strategies
- Prioritize solutions that are maintainable and follow best practices

Focus on practical solutions that can be implemented immediately while also helping developers understand the underlying issues to prevent similar problems.`;
  }

  /**
   * Processes the streaming response from OpenAI
   * @param stream - OpenAI streaming response
   * @returns Async generator yielding content chunks
   */
  private async *streamResponse(stream: any): AsyncGenerator<string> {
    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('❌ Error processing streaming response:', error);
      yield `\n\n❌ Error generating debugging plan: ${error}`;
    }
  }

  /**
   * Generates a quick fix suggestion for simple errors
   * @param error - Parsed error object
   * @returns Quick fix suggestion
   */
  async generateQuickFix(error: ParsedError): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          {
            role: 'system',
            content: 'You are a debugging expert. Provide concise, actionable fix suggestions for programming errors.'
          },
          {
            role: 'user',
            content: `Provide a quick fix for this ${error.type} error: ${error.message}`
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      });

      return response.choices[0]?.message?.content || 'Quick fix generation failed';
    } catch (error) {
      console.error('❌ Failed to generate quick fix:', error);
      return 'Quick fix generation failed';
    }
  }

  /**
   * Analyzes error patterns across multiple errors
   * @param errors - Array of parsed errors
   * @returns Pattern analysis and suggestions
   */
  async analyzeErrorPatterns(errors: ParsedError[]): Promise<{
    commonPatterns: string[];
    suggestions: string[];
    priority: 'low' | 'medium' | 'high';
  }> {
    try {
      const errorSummary = errors.map(e => `${e.type}: ${e.message}`).join('\n');
      
      const response = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          {
            role: 'system',
            content: 'You are a code quality expert. Analyze error patterns and suggest improvements.'
          },
          {
            role: 'user',
            content: `Analyze these error patterns and suggest improvements:\n\n${errorSummary}`
          }
        ],
        temperature: 0.2,
        max_tokens: 300
      });

      const analysis = response.choices[0]?.message?.content || '';
      
      // Simple pattern detection (in a real implementation, you'd want more sophisticated analysis)
      const hasTypeErrors = errors.some(e => e.message.includes('Property') || e.message.includes('type'));
      const hasImportErrors = errors.some(e => e.message.includes('Cannot find module'));
      const hasSyntaxErrors = errors.some(e => e.message.includes('Expected'));
      
      let priority: 'low' | 'medium' | 'high' = 'low';
      if (hasTypeErrors || hasImportErrors) priority = 'high';
      else if (hasSyntaxErrors) priority = 'medium';
      
      return {
        commonPatterns: [analysis],
        suggestions: [analysis],
        priority
      };
    } catch (error) {
      console.error('❌ Failed to analyze error patterns:', error);
      return {
        commonPatterns: ['Pattern analysis failed'],
        suggestions: ['Unable to analyze patterns'],
        priority: 'low'
      };
    }
  }

  /**
   * Gets configuration and usage statistics
   * @returns Debugger statistics
   */
  getStats(): {
    model: string;
    temperature: number;
  } {
    return {
      model: this.config.model!,
      temperature: this.config.temperature!
    };
  }
}
