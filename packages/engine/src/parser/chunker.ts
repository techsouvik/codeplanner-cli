/**
 * Code Chunker for CodePlanner Engine
 * 
 * This module provides utilities for chunking large code files
 * into smaller, more manageable pieces for embedding generation
 * and semantic search operations.
 */

import type { CodeChunk } from '@codeplanner/shared';

/**
 * Configuration for code chunking
 */
export interface ChunkerConfig {
  /** Maximum number of lines per chunk */
  maxLinesPerChunk?: number;
  /** Maximum number of characters per chunk */
  maxCharsPerChunk?: number;
  /** Whether to preserve function/class boundaries */
  preserveBoundaries?: boolean;
  /** Overlap between chunks (in lines) */
  overlapLines?: number;
}

/**
 * Code chunker for breaking down large files into smaller pieces
 * Helps with embedding generation and improves semantic search accuracy
 */
export class CodeChunker {
  private config: ChunkerConfig;

  constructor(config: ChunkerConfig = {}) {
    this.config = {
      maxLinesPerChunk: 100,
      maxCharsPerChunk: 5000,
      preserveBoundaries: true,
      overlapLines: 5,
      ...config
    };
  }

  /**
   * Chunks a large code chunk into smaller pieces
   * @param chunk - Original code chunk to split
   * @returns Array of smaller code chunks
   */
  chunkCodeChunk(chunk: CodeChunk): CodeChunk[] {
    // If chunk is already small enough, return as-is
    if (this.isChunkSmallEnough(chunk)) {
      return [chunk];
    }

    const lines = chunk.content.split('\n');
    
    // If preserving boundaries, try to split at function/class boundaries
    if (this.config.preserveBoundaries) {
      return this.chunkByBoundaries(chunk, lines);
    }

    // Otherwise, split by line count
    return this.chunkByLines(chunk, lines);
  }

  /**
   * Chunks multiple code chunks, splitting large ones
   * @param chunks - Array of code chunks to process
   * @returns Array of processed chunks (some may be split)
   */
  chunkCodeChunks(chunks: CodeChunk[]): CodeChunk[] {
    const result: CodeChunk[] = [];

    for (const chunk of chunks) {
      const chunked = this.chunkCodeChunk(chunk);
      result.push(...chunked);
    }

    return result;
  }

  /**
   * Checks if a chunk is small enough to not need splitting
   * @param chunk - Code chunk to check
   * @returns true if chunk is small enough
   */
  private isChunkSmallEnough(chunk: CodeChunk): boolean {
    const lines = chunk.content.split('\n');
    const chars = chunk.content.length;

    return lines.length <= (this.config.maxLinesPerChunk || 100) &&
           chars <= (this.config.maxCharsPerChunk || 5000);
  }

  /**
   * Chunks code by trying to preserve function/class boundaries
   * @param chunk - Original chunk
   * @param lines - Lines of code
   * @returns Array of chunks
   */
  private chunkByBoundaries(chunk: CodeChunk, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let currentChunk: string[] = [];
    let currentLineCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);
      currentLineCount++;

      // Check if we've hit a boundary or size limit
      const isBoundary = this.isBoundaryLine(line);
      const isSizeLimit = currentLineCount >= (this.config.maxLinesPerChunk || 100);

      if ((isBoundary || isSizeLimit) && currentChunk.length > 0) {
        // Create chunk from current content
        const chunkContent = currentChunk.join('\n');
        chunks.push({
          id: `${chunk.id}:chunk:${chunks.length}`,
          content: chunkContent,
          type: chunk.type,
          filePath: chunk.filePath,
          name: chunk.name ? `${chunk.name}_chunk_${chunks.length}` : undefined
        });

        // Start new chunk with overlap
        const overlap = this.config.overlapLines || 5;
        currentChunk = currentChunk.slice(-overlap);
        currentLineCount = overlap;
      }
    }

    // Add remaining content as final chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push({
        id: `${chunk.id}:chunk:${chunks.length}`,
        content: chunkContent,
        type: chunk.type,
        filePath: chunk.filePath,
        name: chunk.name ? `${chunk.name}_chunk_${chunks.length}` : undefined
      });
    }

    return chunks;
  }

  /**
   * Chunks code by simple line count
   * @param chunk - Original chunk
   * @param lines - Lines of code
   * @returns Array of chunks
   */
  private chunkByLines(chunk: CodeChunk, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const maxLines = this.config.maxLinesPerChunk || 100;
    const overlap = this.config.overlapLines || 5;

    for (let i = 0; i < lines.length; i += maxLines - overlap) {
      const endIndex = Math.min(i + maxLines, lines.length);
      const chunkLines = lines.slice(i, endIndex);
      
      chunks.push({
        id: `${chunk.id}:chunk:${chunks.length}`,
        content: chunkLines.join('\n'),
        type: chunk.type,
        filePath: chunk.filePath,
        name: chunk.name ? `${chunk.name}_chunk_${chunks.length}` : undefined
      });
    }

    return chunks;
  }

  /**
   * Checks if a line represents a code boundary (function/class start/end)
   * @param line - Line of code to check
   * @returns true if line is a boundary
   */
  private isBoundaryLine(line: string): boolean {
    const trimmed = line.trim();
    
    // Function boundaries
    if (trimmed.startsWith('function ') || 
        trimmed.startsWith('export function ') ||
        trimmed.startsWith('const ') && trimmed.includes('= function') ||
        trimmed.startsWith('const ') && trimmed.includes('= async function')) {
      return true;
    }

    // Class boundaries
    if (trimmed.startsWith('class ') || 
        trimmed.startsWith('export class ')) {
      return true;
    }

    // Interface boundaries
    if (trimmed.startsWith('interface ') || 
        trimmed.startsWith('export interface ')) {
      return true;
    }

    // Type boundaries
    if (trimmed.startsWith('type ') || 
        trimmed.startsWith('export type ')) {
      return true;
    }

    return false;
  }

  /**
   * Gets statistics about chunking operation
   * @param originalChunks - Original chunks before chunking
   * @param chunkedChunks - Chunks after chunking
   * @returns Chunking statistics
   */
  getChunkingStats(originalChunks: CodeChunk[], chunkedChunks: CodeChunk[]): {
    originalCount: number;
    chunkedCount: number;
    averageChunkSize: number;
    largestChunk: number;
    smallestChunk: number;
  } {
    const chunkSizes = chunkedChunks.map(chunk => chunk.content.length);
    const totalSize = chunkSizes.reduce((sum, size) => sum + size, 0);

    return {
      originalCount: originalChunks.length,
      chunkedCount: chunkedChunks.length,
      averageChunkSize: Math.round(totalSize / chunkedChunks.length),
      largestChunk: Math.max(...chunkSizes),
      smallestChunk: Math.min(...chunkSizes)
    };
  }
}
