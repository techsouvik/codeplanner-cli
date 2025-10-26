/**
 * Plan command implementation for CodePlanner CLI
 * 
 * This module handles the 'plan' command which generates implementation
 * plans based on user queries and the indexed codebase.
 */

import { CodePlannerClient } from '../client/websocket';
import type { PlanRequest } from '@codeplanner/shared';

/**
 * Handles the plan command execution
 * Connects to the gateway and requests a plan generation
 * @param query - User's planning query
 * @param options - Command line options
 */
export async function planCommand(query: string, options: any) {
  console.log('🧠 Generating implementation plan...\n');
  console.log(`📝 Query: ${query}`);
  console.log(`📁 Project: ${options.project}\n`);
  
  const client = new CodePlannerClient();
  
  try {
    // Connect to the WebSocket gateway
    await client.connect();
    
    // Prepare the plan request
    const request: PlanRequest = {
      command: 'plan',
      userId: 'user1', // TODO: Get from config file
      projectId: 'project1', // TODO: Get from config file
      projectPath: options.project,
      query
    };

    // Set up event handlers for streaming responses
    client.on('stream', (msg: any) => {
      // Stream the plan content as it's generated
      process.stdout.write(msg.data.chunk);
    });

    client.on('response', (msg: any) => {
      if (msg.data.type === 'complete') {
        console.log('\n\n✅ Implementation plan generated successfully!');
        console.log('\n💡 You can now use this plan to implement your feature.');
        client.close();
      }
    });

    client.on('error', (msg: any) => {
      console.error('\n❌ Error generating plan:', msg.data.message);
      client.close();
    });

    // Send the plan request
    client.send(request);
    
  } catch (error) {
    console.error('❌ Failed to connect to CodePlanner gateway:', error);
    console.log('\n🔧 Make sure the gateway is running:');
    console.log('   bun packages/gateway/src/server.ts');
    process.exit(1);
  }
}
