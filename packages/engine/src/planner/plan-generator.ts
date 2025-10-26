/**
 * Plan Generator for CodePlanner Engine
 * 
 * This module provides LLM-powered plan generation capabilities.
 * It takes user queries and relevant code context to generate
 * detailed, step-by-step implementation plans.
 */

import OpenAI from 'openai';
import type { PlanResponse, CodeChunk } from '@codeplanner/shared';
import type { PlanGeneratorConfig } from '../types';

/**
 * LLM-powered plan generator using OpenAI GPT models
 * Generates detailed implementation plans based on user queries and code context
 */
export class PlanGenerator {
  private openai: OpenAI;
  private config: PlanGeneratorConfig;

  constructor(config: PlanGeneratorConfig) {
    this.config = {
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxContextChunks: 15,
      ...config
    };
    
    this.openai = new OpenAI({ 
      apiKey: config.apiKey 
    });
  }

  /**
   * Generates an implementation plan based on user query and relevant code
   * @param query - User's planning query
   * @param relevantCode - Array of relevant code chunks from semantic search
   * @returns Async generator that yields plan content as it's generated
   */
  async generatePlan(
    query: string,
    relevantCode: CodeChunk[]
  ): Promise<AsyncGenerator<string>> {
    try {
      // Limit the number of context chunks to avoid token limits
      const limitedCode = relevantCode.slice(0, this.config.maxContextChunks);
      
      // Build the context from relevant code
      const context = this.buildContext(limitedCode);
      
      // Build the prompt for the LLM
      const prompt = this.buildPrompt(query, context);
      
      console.log(`🧠 Generating plan for query: "${query}"`);
      console.log(`📊 Using ${limitedCode.length} relevant code chunks as context`);
      
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
      console.error('❌ Failed to generate plan:', error);
      throw new Error(`Plan generation failed: ${error}`);
    }
  }

  /**
   * Builds context string from relevant code chunks
   * @param chunks - Array of relevant code chunks
   * @returns Formatted context string
   */
  private buildContext(chunks: CodeChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant code context found.';
    }

    return chunks.map((chunk, index) => {
      const header = `## Code Context ${index + 1}`;
      const fileInfo = `**File:** \`${chunk.filePath}\``;
      const typeInfo = `**Type:** ${chunk.type}`;
      const nameInfo = chunk.name ? `**Name:** \`${chunk.name}\`` : '';
      const similarityInfo = 'similarity' in chunk ? `**Relevance:** ${((chunk as any).similarity * 100).toFixed(1)}%` : '';
      
      return `${header}
${fileInfo}
${typeInfo}
${nameInfo}
${similarityInfo}

\`\`\`typescript
${chunk.content}
\`\`\`
`;
    }).join('\n\n');
  }

  /**
   * Builds the main prompt for plan generation
   * @param query - User's planning query
   * @param context - Formatted code context
   * @returns Complete prompt string
   */
  private buildPrompt(query: string, context: string): string {
    return `# Implementation Planning Request

## User Query
${query}

## Relevant Codebase Context
${context}

## Task
Generate a comprehensive, step-by-step implementation plan that includes:

1. **High-level Overview**: Brief summary of what needs to be implemented
2. **Architecture Decisions**: Key design choices and rationale
3. **Implementation Steps**: Detailed, actionable steps in logical order
4. **File Changes**: Specific files to create, modify, or delete
5. **Code Examples**: Concrete code snippets where helpful
6. **Testing Strategy**: How to verify the implementation works
7. **Potential Challenges**: Anticipated difficulties and solutions

## Format Requirements
- Use clear Markdown formatting with headers and code blocks
- Number all implementation steps
- Include specific file paths and function names
- Provide before/after code examples where applicable
- Keep explanations concise but comprehensive
- Focus on practical, implementable steps

## Context Notes
- The code context above shows relevant existing code from the project
- Use this context to understand the current architecture and patterns
- Build upon existing patterns and conventions
- Consider integration with existing code

Generate a plan that a developer can follow step-by-step to implement the requested feature.`;
  }

  /**
   * Gets the system prompt for the LLM
   * @returns System prompt string
   */
  private getSystemPrompt(): string {
    return `You are an expert software architect and senior developer with deep experience in:

- TypeScript/JavaScript development
- Modern web application architecture
- Code organization and best practices
- API design and implementation
- Database design and optimization
- Testing strategies and quality assurance

Your role is to generate detailed, practical implementation plans that developers can follow to build features efficiently and correctly. 

Key principles:
- Always consider the existing codebase context
- Provide specific, actionable steps
- Include concrete code examples
- Consider edge cases and error handling
- Suggest testing approaches
- Follow established patterns and conventions
- Prioritize maintainable and scalable solutions

Generate plans that are comprehensive yet practical, with clear steps that can be implemented incrementally.`;
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
      yield `\n\n❌ Error generating plan: ${error}`;
    }
  }

  /**
   * Generates a plan summary from the full plan content
   * @param planContent - Full plan content
   * @returns Summary of the plan
   */
  async generatePlanSummary(planContent: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          {
            role: 'system',
            content: 'You are a technical writer. Generate a concise summary of implementation plans.'
          },
          {
            role: 'user',
            content: `Please provide a 2-3 sentence summary of this implementation plan:\n\n${planContent}`
          }
        ],
        temperature: 0.2,
        max_tokens: 200
      });

      return response.choices[0]?.message?.content || 'Summary generation failed';
    } catch (error) {
      console.error('❌ Failed to generate plan summary:', error);
      return 'Summary generation failed';
    }
  }

  /**
   * Validates a plan for completeness and quality
   * @param planContent - Plan content to validate
   * @returns Validation result with suggestions
   */
  async validatePlan(planContent: string): Promise<{
    isValid: boolean;
    score: number;
    suggestions: string[];
  }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          {
            role: 'system',
            content: `You are a code review expert. Evaluate implementation plans for completeness and quality.
            
            Rate plans on:
            - Clarity and specificity of steps
            - Technical accuracy
            - Completeness of implementation
            - Consideration of edge cases
            - Testing strategy
            - Code examples quality
            
            Provide a score from 1-10 and specific suggestions for improvement.`
          },
          {
            role: 'user',
            content: `Please evaluate this implementation plan:\n\n${planContent}`
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      });

      const evaluation = response.choices[0]?.message?.content || '';
      
      // Simple parsing of the evaluation (in a real implementation, you'd want more robust parsing)
      const scoreMatch = evaluation.match(/(\d+)\/10/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
      
      return {
        isValid: score >= 7,
        score,
        suggestions: [evaluation]
      };
    } catch (error) {
      console.error('❌ Failed to validate plan:', error);
      return {
        isValid: false,
        score: 0,
        suggestions: ['Plan validation failed']
      };
    }
  }

  /**
   * Gets configuration and usage statistics
   * @returns Generator statistics
   */
  getStats(): {
    model: string;
    temperature: number;
    maxContextChunks: number;
  } {
    return {
      model: this.config.model!,
      temperature: this.config.temperature!,
      maxContextChunks: this.config.maxContextChunks!
    };
  }
}
