/**
 * WebSocket Gateway Server for CodePlanner
 * 
 * This module implements the WebSocket gateway that acts as a bridge
 * between CLI clients and the CodePlanner engine worker processes.
 * It handles WebSocket connections, message routing, and Redis pub/sub.
 */

import type { ServerWebSocket } from 'bun';
import { GatewayRedisClient } from './redis';
import type { WSData, JobMessage } from './types';
import type { PlanRequest, WSMessage } from '@codeplanner/shared';

/**
 * WebSocket Gateway Server
 * Manages client connections and routes messages to worker processes
 */
class CodePlannerGateway {
  private redis: GatewayRedisClient;
  private server: any;
  private connections: Map<string, ServerWebSocket<WSData>> = new Map();

  constructor() {
    this.redis = new GatewayRedisClient();
  }

  /**
   * Starts the WebSocket gateway server
   */
  async start(): Promise<void> {
    try {
      // Connect to Redis first
      await this.redis.connect();
      
      // Create the Bun WebSocket server
      this.server = Bun.serve<WSData>({
        port: 3000,
        
        // WebSocket configuration
        websocket: {
          // Handle new client connections
          open: (ws) => {
            const connectionId = crypto.randomUUID();
            const userId = 'user1'; // TODO: Implement proper user authentication
            
            // Store connection data
            ws.data = {
              userId,
              connectionId,
              connectedAt: Date.now()
            };
            
            // Track the connection
            this.connections.set(connectionId, ws);
            
            console.log(`🔗 Client connected: ${connectionId} (User: ${userId})`);
          },

          // Handle incoming messages from clients
          message: async (ws, message) => {
            try {
              const msg: WSMessage = JSON.parse(message as string);
              const jobId = crypto.randomUUID();
              
              console.log(`📨 Received ${msg.type} message from ${ws.data.connectionId}`);
              
              // Create job message for worker
              const job: JobMessage = {
                jobId,
                connectionId: ws.data.connectionId,
                userId: ws.data.userId,
                projectId: 'project1', // TODO: Get from request
                command: msg.data.command || 'unknown',
                data: msg.data
              };
              
              // Publish job to worker queue
              await this.redis.publishJob(job);
              
              // Subscribe to results for this job
              await this.redis.subscribeToResults(jobId, (result: any) => {
                this.handleJobResult(ws, result);
              });
              
            } catch (error) {
              console.error('❌ Error processing message:', error);
              this.sendError(ws, 'Invalid message format');
            }
          },

          // Handle client disconnections
          close: (ws) => {
            console.log(`🔌 Client disconnected: ${ws.data.connectionId}`);
            this.connections.delete(ws.data.connectionId);
          }
        },

        // HTTP fetch handler for WebSocket upgrades
        fetch(req, server) {
          const upgraded = server.upgrade(req, {
            data: {
              userId: 'user1',
              connectionId: crypto.randomUUID(),
              connectedAt: Date.now()
            }
          });
          if (!upgraded) {
            return new Response('WebSocket upgrade failed', { status: 500 });
          }
          return undefined;
        }
      });

      console.log(`🚀 CodePlanner Gateway running on ${this.server.url}`);
      console.log('📡 Ready to accept WebSocket connections');
      
    } catch (error) {
      console.error('❌ Failed to start gateway server:', error);
      process.exit(1);
    }
  }

  /**
   * Handles job results from worker processes
   * @param ws - WebSocket connection to send result to
   * @param result - Result message from worker
   */
  private handleJobResult(ws: ServerWebSocket<WSData>, result: any): void {
    try {
      // Create WebSocket message for client
      const wsMessage: WSMessage = {
        type: result.type === 'complete' ? 'response' : 'stream',
        jobId: result.jobId,
        data: result.data
      };
      
      // Send result to client
      ws.send(JSON.stringify(wsMessage));
      
      // If job is complete, unsubscribe from results
      if (result.type === 'complete') {
        this.redis.unsubscribeFromResults(result.jobId);
      }
      
    } catch (error) {
      console.error('❌ Error handling job result:', error);
      this.sendError(ws, 'Failed to process result');
    }
  }

  /**
   * Sends an error message to a client
   * @param ws - WebSocket connection
   * @param message - Error message
   */
  private sendError(ws: ServerWebSocket<WSData>, message: string): void {
    const errorMessage: WSMessage = {
      type: 'error',
      jobId: 'unknown',
      data: { message }
    };
    
    ws.send(JSON.stringify(errorMessage));
  }

  /**
   * Gracefully shuts down the gateway server
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down CodePlanner Gateway...');
    
    // Close all WebSocket connections
    for (const [connectionId, ws] of this.connections) {
      ws.close();
      console.log(`🔌 Closed connection: ${connectionId}`);
    }
    
    // Disconnect from Redis
    await this.redis.disconnect();
    
    // Stop the server
    this.server.stop();
    
    console.log('✅ Gateway shutdown complete');
  }
}

// Create and start the gateway server
const gateway = new CodePlannerGateway();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await gateway.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await gateway.shutdown();
  process.exit(0);
});

// Start the server
gateway.start().catch((error) => {
  console.error('❌ Failed to start gateway:', error);
  process.exit(1);
});
