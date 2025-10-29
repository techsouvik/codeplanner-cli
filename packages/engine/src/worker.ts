/**
 * Main Worker Process for CodePlanner Engine
 * 
 * This module implements the main worker process that handles all
 * CodePlanner operations including indexing, planning, and error analysis.
 * It connects to Redis for job processing and coordinates all engine components.
 */

import { createClient, RedisClientType } from 'redis';
import { ASTParser } from './parser/ast-parser';
import { CodeChunker } from './parser/chunker';
import { EmbeddingGenerator } from './embeddings/generator';
import { RedisVectorStore } from './vector-store/redis-store';
import { PlanGenerator } from './planner/plan-generator';
import { ErrorParser } from './error-analysis/error-parser';
import { Debugger } from './error-analysis/debugger';
import type { JobMessage, JobResult, ProgressInfo } from './types';

/**
 * Main CodePlanner Worker Process
 * Handles all job processing including indexing, planning, and error analysis
 */
class CodePlannerWorker {
  private redis: RedisClientType;
  private vectorStore: RedisVectorStore;
  private embeddingGen: EmbeddingGenerator;
  private planGen: PlanGenerator;
  private errorParser: ErrorParser;
  private chunker: CodeChunker;
  private isRunning: boolean = false;

  constructor() {
    // Initialize Redis client
    this.redis = createClient({ 
      url: process.env.REDIS_URL || 'redis://localhost:6379' 
    });
    
    // Initialize vector store
    this.vectorStore = new RedisVectorStore({
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    // Resolve API credentials and endpoints (separate providers supported)
    // Embeddings provider
    const EMB_API_KEY =
      process.env.EMBEDDING_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY;
    if (!EMB_API_KEY) {
      throw new Error('Missing embedding API key. Set EMBEDDING_API_KEY or OPENAI_API_KEY or OPENROUTER_API_KEY');
    }
    const EMB_BASE_URL =
      process.env.EMBEDDING_BASE_URL ||
      process.env.LLM_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      undefined;
    const EMB_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    const BATCH_SIZE = process.env.BATCH_SIZE ? Number(process.env.BATCH_SIZE) : 20;

    // Planning provider
    const PLAN_API_KEY =
      process.env.PLANNING_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY;
    if (!PLAN_API_KEY) {
      throw new Error('Missing planning API key. Set PLANNING_API_KEY or OPENAI_API_KEY or OPENROUTER_API_KEY');
    }
    const PLAN_BASE_URL =
      process.env.PLANNING_BASE_URL ||
      process.env.LLM_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      undefined;
    const PLAN_MODEL = process.env.PLANNING_MODEL || 'gpt-4-turbo-preview';
    const TEMPERATURE = process.env.TEMPERATURE ? Number(process.env.TEMPERATURE) : 0.3;
    const MAX_CONTEXT_CHUNKS = process.env.MAX_CONTEXT_CHUNKS ? Number(process.env.MAX_CONTEXT_CHUNKS) : 15;

    // Initialize embedding generator
    this.embeddingGen = new EmbeddingGenerator({
      apiKey: EMB_API_KEY,
      baseUrl: EMB_BASE_URL,
      model: EMB_MODEL,
      batchSize: BATCH_SIZE
    });
    
    // Initialize plan generator
    this.planGen = new PlanGenerator({
      apiKey: PLAN_API_KEY,
      baseUrl: PLAN_BASE_URL,
      model: PLAN_MODEL,
      temperature: TEMPERATURE,
      maxContextChunks: MAX_CONTEXT_CHUNKS
    });
    
    // Initialize error parser and chunker
    this.errorParser = new ErrorParser();
    this.chunker = new CodeChunker({
      maxLinesPerChunk: 100,
      maxCharsPerChunk: 5000,
      preserveBoundaries: true,
      overlapLines: 5
    });
    
    // Set up error handling
    this.redis.on('error', (err) => {
      console.error('❌ Redis worker error:', err);
    });
  }

  /**
   * Starts the worker process
   */
  async start(): Promise<void> {
    try {
      // Connect to Redis
      await this.redis.connect();
      await this.vectorStore.connect();
      
      this.isRunning = true;
      console.log('🚀 CodePlanner Worker started');
      console.log('📡 Listening for jobs on Redis channel: jobs:pending');
      
      // Subscribe to job queue
      await this.redis.subscribe('jobs:pending', async (message) => {
        try {
          const job: JobMessage = JSON.parse(message);
          await this.processJob(job);
        } catch (error) {
          console.error('❌ Error processing job message:', error);
        }
      });
      
    } catch (error) {
      console.error('❌ Failed to start worker:', error);
      throw error;
    }
  }

  /**
   * Processes a single job from the queue
   * @param job - Job message to process
   */
  private async processJob(job: JobMessage): Promise<void> {
    console.log(`\n📋 Processing job: ${job.jobId} - ${job.command}`);
    console.log(`👤 User: ${job.userId}, Project: ${job.projectId}`);
    
    try {
      switch (job.command) {
        case 'index':
          await this.handleIndex(job);
          break;
        case 'plan':
          await this.handlePlan(job);
          break;
        case 'analyze-error':
          await this.handleErrorAnalysis(job);
          break;
        default:
          throw new Error(`Unknown command: ${job.command}`);
      }
    } catch (error) {
      console.error(`❌ Error processing job ${job.jobId}:`, error);
      await this.publishError(job.jobId, error);
    }
  }

  /**
   * Handles codebase indexing jobs
   * @param job - Indexing job
   */
  private async handleIndex(job: JobMessage): Promise<void> {
    console.log(`📚 Starting codebase indexing for: ${job.data.projectPath}`);
    
    try {
      // Initialize AST parser
      const parser = new ASTParser({
        projectPath: job.data.projectPath,
        includeNodeModules: false,
        fileExtensions: ['.ts', '.tsx', '.js', '.jsx']
      });
      
      // Parse the codebase
      const chunks = parser.parseCodebase();
      console.log(`📊 Extracted ${chunks.length} code chunks`);
      
      // Chunk large code pieces if needed
      const chunkedChunks = this.chunker.chunkCodeChunks(chunks);
      console.log(`📦 Processed into ${chunkedChunks.length} chunks after chunking`);
      
      // Clear existing project data
      await this.vectorStore.clearProject(job.userId, job.projectId);
      
      // Generate embeddings in batches
      const batchSize = 20;
      let processedCount = 0;
      
      for (let i = 0; i < chunkedChunks.length; i += batchSize) {
        const batch = chunkedChunks.slice(i, i + batchSize);
        
        // Send progress update
        await this.publishProgress(job.jobId, {
          current: processedCount,
          total: chunkedChunks.length,
          message: 'Generating embeddings',
          percentage: Math.round((processedCount / chunkedChunks.length) * 100)
        });
        
        // Generate embeddings for this batch
        const embeddings = await this.embeddingGen.generateEmbeddingsForChunks(batch);
        
        // Add embeddings to chunks
        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = embeddings[j];
        }
        
        // Store chunks in vector database
        await this.vectorStore.storeChunks(job.userId, job.projectId, batch);
        
        processedCount += batch.length;
        console.log(`📈 Processed ${processedCount}/${chunkedChunks.length} chunks`);
      }
      
      // Get final statistics
      const stats = await this.vectorStore.getStats(job.userId, job.projectId);
      
      // Send completion message
      await this.publishResult(job.jobId, {
        type: 'complete',
        data: {
          message: `Successfully indexed ${stats.totalChunks} code chunks`,
          stats: {
            totalChunks: stats.totalChunks,
            totalSize: stats.totalSize,
            chunkTypes: stats.chunkTypes
          }
        }
      });
      
      console.log(`✅ Indexing completed: ${stats.totalChunks} chunks stored`);
      
    } catch (error) {
      console.error('❌ Indexing failed:', error);
      throw error;
    }
  }

  /**
   * Handles plan generation jobs
   * @param job - Planning job
   */
  private async handlePlan(job: JobMessage): Promise<void> {
    console.log(`🧠 Generating plan for query: "${job.data.query}"`);
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingGen.generateEmbedding(job.data.query);
      
      // Search for relevant code
      const relevantCode = await this.vectorStore.searchSimilar(
        job.userId,
        job.projectId,
        queryEmbedding,
        15
      );
      
      console.log(`🔍 Found ${relevantCode.length} relevant code chunks`);
      
      // Generate plan using streaming
      const stream = await this.planGen.generatePlan(job.data.query, relevantCode);
      
      // Stream the plan content
      for await (const chunk of stream) {
        await this.publishResult(job.jobId, {
          type: 'stream',
          data: { chunk }
        });
      }
      
      // Send completion message
      await this.publishResult(job.jobId, {
        type: 'complete',
        data: { type: 'complete' }
      });
      
      console.log(`✅ Plan generation completed`);
      
    } catch (error) {
      console.error('❌ Plan generation failed:', error);
      throw error;
    }
  }

  /**
   * Handles error analysis jobs
   * @param job - Error analysis job
   */
  private async handleErrorAnalysis(job: JobMessage): Promise<void> {
    console.log(`🐛 Analyzing error: ${job.data.errorType}`);
    
    try {
      // Parse the error
      let parsedError;
      if (job.data.errorType === 'compiler') {
        const errors = this.errorParser.parseTypeScriptError(job.data.errorInput);
        parsedError = errors[0]; // Take the first error
      } else if (job.data.errorType === 'linter') {
        const errors = this.errorParser.parseLinterError(job.data.errorInput);
        parsedError = errors[0]; // Take the first error
      } else {
        parsedError = this.errorParser.parseRuntimeError(job.data.errorInput);
      }
      
      if (!parsedError) {
        throw new Error('Failed to parse error input');
      }
      
      console.log(`📋 Parsed error: ${parsedError.type} - ${parsedError.message}`);
      
      // Generate error embedding for semantic search
      const errorEmbedding = await this.embeddingGen.generateEmbedding(
        parsedError.message + ' ' + (parsedError.filePath || '')
      );
      
      // Search for relevant code
      const relevantCode = await this.vectorStore.searchSimilar(
        job.userId,
        job.projectId,
        errorEmbedding,
        10
      );
      
      console.log(`🔍 Found ${relevantCode.length} relevant code chunks for error analysis`);
      
      // Initialize debugger with AST parser
      const parser = new ASTParser({
        projectPath: job.data.projectPath
      });
      
      const errorDebugger = new Debugger({
        apiKey:
          process.env.DEBUG_API_KEY ||
          process.env.PLANNING_API_KEY ||
          process.env.OPENAI_API_KEY ||
          process.env.OPENROUTER_API_KEY!,
        baseUrl:
          process.env.DEBUG_BASE_URL ||
          process.env.PLANNING_BASE_URL ||
          process.env.LLM_BASE_URL ||
          process.env.OPENAI_BASE_URL ||
          undefined,
        model:
          process.env.DEBUG_MODEL ||
          process.env.PLANNING_MODEL ||
          'gpt-4-turbo-preview',
        temperature: process.env.TEMPERATURE ? Number(process.env.TEMPERATURE) : 0.2
      }, parser);
      
      // Generate debugging plan using streaming
      const stream = await errorDebugger.analyzeError(parsedError, relevantCode);
      
      // Stream the debugging plan content
      for await (const chunk of stream) {
        await this.publishResult(job.jobId, {
          type: 'stream',
          data: { chunk }
        });
      }
      
      // Send completion message
      await this.publishResult(job.jobId, {
        type: 'complete',
        data: { type: 'complete' }
      });
      
      console.log(`✅ Error analysis completed`);
      
    } catch (error) {
      console.error('❌ Error analysis failed:', error);
      throw error;
    }
  }

  /**
   * Publishes a result message to Redis
   * @param jobId - Job ID
   * @param result - Result data
   */
  private async publishResult(jobId: string, result: Omit<JobResult, 'jobId' | 'timestamp'>): Promise<void> {
    try {
      const message = JSON.stringify({
        jobId,
        type: result.type,
        data: result.data,
        timestamp: Date.now()
      });
      
      await this.redis.publish(`results:${jobId}`, message);
    } catch (error) {
      console.error('❌ Failed to publish result:', error);
    }
  }

  /**
   * Publishes a progress update
   * @param jobId - Job ID
   * @param progress - Progress information
   */
  private async publishProgress(jobId: string, progress: ProgressInfo): Promise<void> {
    await this.publishResult(jobId, {
      type: 'stream',
      data: { progress }
    });
  }

  /**
   * Publishes an error message
   * @param jobId - Job ID
   * @param error - Error object
   */
  private async publishError(jobId: string, error: any): Promise<void> {
    await this.publishResult(jobId, {
      type: 'error',
      data: {
        message: error.message || 'Unknown error occurred',
        stack: error.stack
      }
    });
  }

  /**
   * Gracefully shuts down the worker
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down CodePlanner Worker...');
    
    this.isRunning = false;
    
    try {
      await this.vectorStore.disconnect();
      await this.redis.quit();
      console.log('✅ Worker shutdown complete');
    } catch (error) {
      console.error('❌ Error during worker shutdown:', error);
    }
  }

  /**
   * Gets worker status and statistics
   * @returns Worker status information
   */
  getStatus(): {
    isRunning: boolean;
    redisConnected: boolean;
    vectorStoreConnected: boolean;
  } {
    return {
      isRunning: this.isRunning,
      redisConnected: this.redis.isReady,
      vectorStoreConnected: this.vectorStore.isRedisConnected()
    };
  }
}

// Create and start the worker
const worker = new CodePlannerWorker();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await worker.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await worker.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught exception:', error);
  await worker.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ Unhandled rejection:', reason);
  await worker.shutdown();
  process.exit(1);
});

// Start the worker
worker.start().catch((error) => {
  console.error('❌ Failed to start worker:', error);
  process.exit(1);
});
