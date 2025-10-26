/**
 * Engine-specific types and interfaces
 * 
 * This module defines types specific to the CodePlanner engine
 * that are not shared with other packages.
 */

import type { CodeChunk } from '@codeplanner/shared';

/**
 * Configuration for the AST parser
 */
export interface ASTParserConfig {
  /** Path to the TypeScript project */
  projectPath: string;
  /** Path to tsconfig.json file */
  tsConfigPath?: string;
  /** Whether to include node_modules in parsing */
  includeNodeModules?: boolean;
  /** File extensions to parse */
  fileExtensions?: string[];
}

/**
 * Configuration for the embedding generator
 */
export interface EmbeddingConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Embedding model to use */
  model?: string;
  /** Batch size for embedding generation */
  batchSize?: number;
}

/**
 * Configuration for the vector store
 */
export interface VectorStoreConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Key prefix for storing vectors */
  keyPrefix?: string;
  /** Maximum number of results to return in search */
  maxResults?: number;
}

/**
 * Configuration for the plan generator
 */
export interface PlanGeneratorConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Model to use for plan generation */
  model?: string;
  /** Temperature for plan generation */
  temperature?: number;
  /** Maximum number of relevant code chunks to include */
  maxContextChunks?: number;
}

/**
 * Job message structure for Redis pub/sub
 * Used to communicate between gateway and worker processes
 */
export interface JobMessage {
  /** Unique job identifier */
  jobId: string;
  /** Connection ID of the client that initiated the job */
  connectionId: string;
  /** User ID of the client */
  userId: string;
  /** Project ID being worked on */
  projectId: string;
  /** Command type being executed */
  command: string;
  /** Additional job data */
  data: any;
}

/**
 * Job processing result
 */
export interface JobResult {
  /** Job ID */
  jobId: string;
  /** Result type */
  type: 'stream' | 'complete' | 'error';
  /** Result data */
  data: any;
  /** Timestamp */
  timestamp: number;
}

/**
 * Progress information for long-running operations
 */
export interface ProgressInfo {
  /** Current progress value */
  current: number;
  /** Total progress value */
  total: number;
  /** Progress message */
  message: string;
  /** Progress percentage */
  percentage: number;
}
