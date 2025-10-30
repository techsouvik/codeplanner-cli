/**
 * Redis client configuration and utilities for the gateway
 * 
 * This module handles Redis connection management and provides
 * utilities for pub/sub operations between gateway and worker processes.
 */

import { createClient, RedisClientType } from 'redis';
import type { JobMessage, ResultMessage } from './types';

/**
 * Redis client wrapper for the gateway
 * Manages connection and provides typed pub/sub operations
 */
export class GatewayRedisClient {
  private redis: RedisClientType;
  private subscriber: RedisClientType;
  private isConnected: boolean = false;

  constructor(redisUrl: string = 'redis://redis:6379') {
    // Main Redis client for publishing jobs
    this.redis = createClient({ url: redisUrl });
    
    // Separate subscriber client for receiving results
    this.subscriber = createClient({ url: redisUrl });
    
    // Set up error handlers
    this.redis.on('error', (err) => {
      console.error('❌ Redis client error:', err);
    });
    
    this.subscriber.on('error', (err) => {
      console.error('❌ Redis subscriber error:', err);
    });
  }

  /**
   * Establishes connection to Redis server
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      await this.subscriber.connect();
      this.isConnected = true;
      console.log('🔗 Connected to Redis server');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Publishes a job message to the worker queue
   * @param job - Job message to publish
   */
  async publishJob(job: JobMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    try {
      await this.redis.publish('jobs:pending', JSON.stringify(job));
      console.log(`📤 Published job ${job.jobId} to worker queue`);
    } catch (error) {
      console.error('❌ Failed to publish job:', error);
      throw error;
    }
  }

  /**
   * Subscribes to result messages for a specific job
   * @param jobId - Job ID to subscribe to results for
   * @param callback - Callback function to handle result messages
   */
  async subscribeToResults(jobId: string, callback: (result: ResultMessage) => void): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis subscriber is not connected');
    }
    
    try {
      const channel = `results:${jobId}`;
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const result: ResultMessage = JSON.parse(message);
          callback(result);
        } catch (error) {
          console.error('❌ Failed to parse result message:', error);
        }
      });
      console.log(`📥 Subscribed to results for job ${jobId}`);
    } catch (error) {
      console.error('❌ Failed to subscribe to results:', error);
      throw error;
    }
  }

  /**
   * Unsubscribes from result messages for a specific job
   * @param jobId - Job ID to unsubscribe from
   */
  async unsubscribeFromResults(jobId: string): Promise<void> {
    try {
      const channel = `results:${jobId}`;
      await this.subscriber.unsubscribe(channel);
      console.log(`📤 Unsubscribed from results for job ${jobId}`);
    } catch (error) {
      console.error('❌ Failed to unsubscribe from results:', error);
    }
  }

  /**
   * Closes the Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      await this.subscriber.quit();
      this.isConnected = false;
      console.log('🔌 Disconnected from Redis server');
    } catch (error) {
      console.error('❌ Error disconnecting from Redis:', error);
    }
  }

  /**
   * Checks if the Redis client is connected
   * @returns true if connected, false otherwise
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }
}
