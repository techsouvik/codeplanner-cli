/**
 * Gateway-specific types and interfaces
 * 
 * This module defines types specific to the WebSocket gateway
 * that are not shared with other packages.
 */

import type { ServerWebSocket } from 'bun';

/**
 * WebSocket connection data structure
 * Contains information about each connected client
 */
export interface WSData {
  /** Unique identifier for the user */
  userId: string;
  /** Unique identifier for this connection */
  connectionId: string;
  /** Timestamp when connection was established */
  connectedAt: number;
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
 * Result message structure for Redis pub/sub
 * Used to send results back from worker to gateway
 */
export interface ResultMessage {
  /** Job ID this result belongs to */
  jobId: string;
  /** Type of result (stream, complete, error) */
  type: 'stream' | 'complete' | 'error';
  /** Result data */
  data: any;
  /** Timestamp when result was generated */
  timestamp: number;
}
