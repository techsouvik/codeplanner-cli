/**
 * WebSocket client for CodePlanner CLI
 * 
 * This module provides a WebSocket client that connects to the CodePlanner gateway
 * and handles real-time communication for streaming responses and status updates.
 */

import type { WSMessage } from '@codeplanner/shared';

/**
 * WebSocket client for communicating with CodePlanner gateway
 * Handles connection management, message routing, and event handling
 */
export class CodePlannerClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Function> = new Map();

  /**
   * Establishes WebSocket connection to the CodePlanner gateway
   * @param url - WebSocket server URL (defaults to localhost:3000)
   * @returns Promise that resolves when connection is established
   */
  async connect(url: string = 'ws://localhost:3000'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      // Handle successful connection
      this.ws.onopen = () => {
        console.log('🔗 Connected to CodePlanner gateway');
        resolve();
      };
      
      // Handle connection errors
      this.ws.onerror = (err) => {
        console.error('❌ WebSocket connection error:', err);
        reject(err);
      };
      
      // Handle incoming messages
      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          const handler = this.handlers.get(msg.type);
          if (handler) {
            handler(msg);
          } else {
            console.warn(`⚠️  No handler registered for message type: ${msg.type}`);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
    });
  }

  /**
   * Registers an event handler for specific message types
   * @param event - Message type to listen for
   * @param handler - Function to call when message is received
   */
  on(event: string, handler: Function): void {
    this.handlers.set(event, handler);
  }

  /**
   * Sends data to the WebSocket server
   * @param data - Data to send (will be JSON stringified)
   */
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('❌ WebSocket is not connected');
    }
  }

  /**
   * Closes the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('🔌 Disconnected from CodePlanner gateway');
    }
  }

  /**
   * Checks if the WebSocket connection is active
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
