/**
 * Redis Vector Store for CodePlanner Engine
 * 
 * This module provides vector storage and similarity search capabilities
 * using Redis as the backend. It stores code chunk embeddings and enables
 * fast semantic search for relevant code during planning operations.
 */

import { createClient, RedisClientType } from 'redis';
import type { CodeChunk } from '@codeplanner/shared';
import type { VectorStoreConfig } from '../types';

/**
 * Redis-based vector store for code chunk embeddings
 * Provides storage, retrieval, and similarity search functionality
 */
export class RedisVectorStore {
  private redis: RedisClientType;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = {
      keyPrefix: 'codeplanner:vectors',
      maxResults: 20,
      ...config
    };
    
    this.redis = createClient({ url: config.redisUrl });
    
    // Set up error handling
    this.redis.on('error', (err) => {
      console.error('❌ Redis vector store error:', err);
    });
  }

  /**
   * Establishes connection to Redis server
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('🔗 Connected to Redis vector store');
    } catch (error) {
      console.error('❌ Failed to connect to Redis vector store:', error);
      throw error;
    }
  }

  /**
   * Stores a code chunk with its embedding in Redis
   * @param userId - User identifier
   * @param projectId - Project identifier
   * @param chunk - Code chunk with embedding to store
   */
  async storeChunk(userId: string, projectId: string, chunk: CodeChunk): Promise<void> {
    if (!chunk.embedding) {
      throw new Error('Code chunk must have an embedding to store');
    }

    try {
      const key = this.getChunkKey(userId, projectId, chunk.id);
      
      // Store chunk metadata and embedding
      await this.redis.hSet(key, {
        id: chunk.id,
        content: chunk.content,
        type: chunk.type,
        filePath: chunk.filePath,
        name: chunk.name || '',
        embedding: JSON.stringify(chunk.embedding),
        createdAt: Date.now().toString()
      });
      
      // Add to project index for easy cleanup
      await this.redis.sAdd(this.getProjectIndexKey(userId, projectId), chunk.id);
      
      console.log(`💾 Stored chunk: ${chunk.id}`);
    } catch (error) {
      console.error('❌ Failed to store chunk:', error);
      throw error;
    }
  }

  /**
   * Stores multiple code chunks in batch
   * @param userId - User identifier
   * @param projectId - Project identifier
   * @param chunks - Array of code chunks to store
   */
  async storeChunks(userId: string, projectId: string, chunks: CodeChunk[]): Promise<void> {
    console.log(`📦 Storing ${chunks.length} chunks in batch...`);
    
    const pipeline = this.redis.multi();
    
    for (const chunk of chunks) {
      if (!chunk.embedding) {
        console.warn(`⚠️  Skipping chunk ${chunk.id} - no embedding`);
        continue;
      }
      
      const key = this.getChunkKey(userId, projectId, chunk.id);
      
      pipeline.hSet(key, {
        id: chunk.id,
        content: chunk.content,
        type: chunk.type,
        filePath: chunk.filePath,
        name: chunk.name || '',
        embedding: JSON.stringify(chunk.embedding),
        createdAt: Date.now().toString()
      });
      
      pipeline.sAdd(this.getProjectIndexKey(userId, projectId), chunk.id);
    }
    
    await pipeline.exec();
    console.log(`✅ Stored ${chunks.length} chunks successfully`);
  }

  /**
   * Searches for similar code chunks using vector similarity
   * @param userId - User identifier
   * @param projectId - Project identifier
   * @param queryEmbedding - Query embedding to search for
   * @param limit - Maximum number of results to return
   * @returns Array of similar code chunks with similarity scores
   */
  async searchSimilar(
    userId: string,
    projectId: string,
    queryEmbedding: number[],
    limit: number = 10
  ): Promise<Array<CodeChunk & { similarity: number }>> {
    try {
      // Get all chunk IDs for this project
      const chunkIds = await this.redis.sMembers(this.getProjectIndexKey(userId, projectId));
      
      if (chunkIds.length === 0) {
        console.log('📭 No chunks found for project');
        return [];
      }
      
      console.log(`🔍 Searching ${chunkIds.length} chunks for similar code...`);
      
      // Retrieve all chunks and calculate similarities
      const chunks: Array<CodeChunk & { similarity: number }> = [];
      
      for (const chunkId of chunkIds) {
        const key = this.getChunkKey(userId, projectId, chunkId);
        const data = await this.redis.hGetAll(key);
        
        if (data.embedding) {
          const embedding = JSON.parse(data.embedding);
          const similarity = this.cosineSimilarity(queryEmbedding, embedding);
          
          chunks.push({
            id: data.id,
            content: data.content,
            type: data.type as any,
            filePath: data.filePath,
            name: data.name || undefined,
            embedding: embedding,
            similarity
          });
        }
      }
      
      // Sort by similarity and return top results
      const results = chunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, Math.min(limit, this.config.maxResults!));
      
      console.log(`🎯 Found ${results.length} similar chunks (top similarity: ${results[0]?.similarity.toFixed(3) || 0})`);
      return results;
      
    } catch (error) {
      console.error('❌ Failed to search similar chunks:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific code chunk by ID
   * @param userId - User identifier
   * @param projectId - Project identifier
   * @param chunkId - Chunk identifier
   * @returns Code chunk or null if not found
   */
  async getChunk(userId: string, projectId: string, chunkId: string): Promise<CodeChunk | null> {
    try {
      const key = this.getChunkKey(userId, projectId, chunkId);
      const data = await this.redis.hGetAll(key);
      
      if (!data.id) {
        return null;
      }
      
      return {
        id: data.id,
        content: data.content,
        type: data.type as any,
        filePath: data.filePath,
        name: data.name || undefined,
        embedding: data.embedding ? JSON.parse(data.embedding) : undefined
      };
    } catch (error) {
      console.error('❌ Failed to get chunk:', error);
      return null;
    }
  }

  /**
   * Deletes all chunks for a specific project
   * @param userId - User identifier
   * @param projectId - Project identifier
   */
  async clearProject(userId: string, projectId: string): Promise<void> {
    try {
      const indexKey = this.getProjectIndexKey(userId, projectId);
      const chunkIds = await this.redis.sMembers(indexKey);
      
      if (chunkIds.length === 0) {
        console.log('📭 No chunks to clear for project');
        return;
      }
      
      const pipeline = this.redis.multi();
      
      // Delete all chunk keys
      for (const chunkId of chunkIds) {
        const key = this.getChunkKey(userId, projectId, chunkId);
        pipeline.del(key);
      }
      
      // Delete the project index
      pipeline.del(indexKey);
      
      await pipeline.exec();
      console.log(`🗑️  Cleared ${chunkIds.length} chunks for project`);
      
    } catch (error) {
      console.error('❌ Failed to clear project chunks:', error);
      throw error;
    }
  }

  /**
   * Gets statistics about stored chunks
   * @param userId - User identifier
   * @param projectId - Project identifier
   * @returns Storage statistics
   */
  async getStats(userId: string, projectId: string): Promise<{
    totalChunks: number;
    totalSize: number;
    chunkTypes: Record<string, number>;
  }> {
    try {
      const chunkIds = await this.redis.sMembers(this.getProjectIndexKey(userId, projectId));
      let totalSize = 0;
      const chunkTypes: Record<string, number> = {};
      
      for (const chunkId of chunkIds) {
        const key = this.getChunkKey(userId, projectId, chunkId);
        const data = await this.redis.hGetAll(key);
        
        if (data.content) {
          totalSize += data.content.length;
          chunkTypes[data.type] = (chunkTypes[data.type] || 0) + 1;
        }
      }
      
      return {
        totalChunks: chunkIds.length,
        totalSize,
        chunkTypes
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return { totalChunks: 0, totalSize: 0, chunkTypes: {} };
    }
  }

  /**
   * Calculates cosine similarity between two embeddings
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity score (0-1)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
    }
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generates Redis key for a code chunk
   * @param userId - User identifier
   * @param projectId - Project identifier
   * @param chunkId - Chunk identifier
   * @returns Redis key string
   */
  private getChunkKey(userId: string, projectId: string, chunkId: string): string {
    return `${this.config.keyPrefix}:${userId}:${projectId}:${chunkId}`;
  }

  /**
   * Generates Redis key for project index
   * @param userId - User identifier
   * @param projectId - Project identifier
   * @returns Redis key string
   */
  private getProjectIndexKey(userId: string, projectId: string): string {
    return `${this.config.keyPrefix}:index:${userId}:${projectId}`;
  }

  /**
   * Checks if the Redis client is connected
   * @returns true if connected, false otherwise
   */
  isRedisConnected(): boolean {
    return this.redis.isReady;
  }

  /**
   * Closes the Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      console.log('🔌 Disconnected from Redis vector store');
    } catch (error) {
      console.error('❌ Error disconnecting from Redis vector store:', error);
    }
  }
}
