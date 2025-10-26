/**
 * Embeddings Generator for CodePlanner Engine
 * 
 * This module provides functionality to generate vector embeddings
 * for code chunks using OpenAI's embedding models. These embeddings
 * enable semantic search and similarity matching for planning operations.
 */

import OpenAI from 'openai';
import type { EmbeddingConfig } from '../types';

/**
 * Embeddings generator using OpenAI's embedding models
 * Converts text (code) into vector representations for semantic search
 */
export class EmbeddingGenerator {
  private openai: OpenAI;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = {
      model: 'text-embedding-3-small',
      batchSize: 20,
      ...config
    };
    
    this.openai = new OpenAI({ 
      apiKey: config.apiKey 
    });
  }

  /**
   * Generates a single embedding for the given text
   * @param text - Text to generate embedding for
   * @returns Vector embedding as array of numbers
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text if it's too long (OpenAI has limits)
      const truncatedText = this.truncateText(text);
      
      const response = await this.openai.embeddings.create({
        model: this.config.model!,
        input: truncatedText
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generates embeddings for multiple texts in a single batch
   * More efficient than individual calls for large datasets
   * @param texts - Array of texts to generate embeddings for
   * @returns Array of vector embeddings
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    try {
      // Process in batches to avoid API limits
      const batchSize = this.config.batchSize!;
      const results: number[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const truncatedBatch = batch.map(text => this.truncateText(text));
        
        console.log(`📊 Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
        
        const response = await this.openai.embeddings.create({
          model: this.config.model!,
          input: truncatedBatch
        });
        
        const batchEmbeddings = response.data.map(d => d.embedding);
        results.push(...batchEmbeddings);
        
        // Add small delay to respect rate limits
        if (i + batchSize < texts.length) {
          await this.delay(100);
        }
      }
      
      return results;
    } catch (error) {
      console.error('❌ Failed to generate batch embeddings:', error);
      throw new Error(`Batch embedding generation failed: ${error}`);
    }
  }

  /**
   * Generates embeddings for code chunks
   * @param chunks - Array of code chunks to process
   * @returns Array of embeddings corresponding to the chunks
   */
  async generateEmbeddingsForChunks(chunks: { content: string }[]): Promise<number[][]> {
    const texts = chunks.map(chunk => this.prepareCodeForEmbedding(chunk.content));
    return this.generateBatch(texts);
  }

  /**
   * Prepares code content for embedding generation
   * Cleans and formats code to improve embedding quality
   * @param code - Raw code content
   * @returns Prepared code text
   */
  private prepareCodeForEmbedding(code: string): string {
    // Remove excessive whitespace and normalize
    let prepared = code
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .trim();
    
    // Add context markers for better semantic understanding
    if (prepared.includes('function ')) {
      prepared = `function code: ${prepared}`;
    } else if (prepared.includes('class ')) {
      prepared = `class definition: ${prepared}`;
    } else if (prepared.includes('interface ')) {
      prepared = `interface definition: ${prepared}`;
    } else {
      prepared = `code file: ${prepared}`;
    }
    
    return prepared;
  }

  /**
   * Truncates text to fit within OpenAI's token limits
   * @param text - Text to truncate
   * @returns Truncated text
   */
  private truncateText(text: string): string {
    // Rough estimation: 1 token ≈ 4 characters
    // OpenAI embedding models have limits (e.g., 8192 tokens for text-embedding-3-small)
    const maxChars = 30000; // Conservative limit
    
    if (text.length <= maxChars) {
      return text;
    }
    
    // Truncate and add indicator
    return text.substring(0, maxChars) + '... [truncated]';
  }

  /**
   * Calculates cosine similarity between two embeddings
   * @param embedding1 - First embedding vector
   * @param embedding2 - Second embedding vector
   * @returns Cosine similarity score (0-1)
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }
    
    // Calculate dot product
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    
    // Calculate magnitudes
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
    
    // Calculate cosine similarity
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Finds the most similar embeddings to a query embedding
   * @param queryEmbedding - Query embedding to compare against
   * @param candidateEmbeddings - Array of candidate embeddings
   * @param topK - Number of top results to return
   * @returns Array of similarity scores and indices
   */
  findMostSimilar(
    queryEmbedding: number[], 
    candidateEmbeddings: number[][], 
    topK: number = 10
  ): Array<{ index: number; similarity: number }> {
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      index,
      similarity: this.calculateSimilarity(queryEmbedding, embedding)
    }));
    
    // Sort by similarity (descending) and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Gets statistics about the embedding generator
   * @returns Configuration and usage statistics
   */
  getStats(): {
    model: string;
    batchSize: number;
    maxTextLength: number;
  } {
    return {
      model: this.config.model!,
      batchSize: this.config.batchSize!,
      maxTextLength: 30000
    };
  }

  /**
   * Utility function to add delays between API calls
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
