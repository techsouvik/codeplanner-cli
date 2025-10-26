/**
 * Index command implementation for CodePlanner CLI
 * 
 * This module handles the 'index' command which analyzes the codebase,
 * extracts code chunks, generates embeddings, and stores them for
 * semantic search and planning operations.
 */

import { CodePlannerClient } from '../client/websocket';
import type { PlanRequest } from '@codeplanner/shared';

/**
 * Handles the index command execution
 * Connects to the gateway and requests codebase indexing
 * @param options - Command line options
 */
export async function indexCommand(options: any) {
  console.log('📚 Indexing codebase for semantic search...\n');
  console.log(`📁 Project: ${options.project}\n`);
  
  const client = new CodePlannerClient();
  
  try {
    // Connect to the WebSocket gateway
    await client.connect();
    
    // Prepare the indexing request
    const request: PlanRequest = {
      command: 'index',
      userId: 'user1', // TODO: Get from config file
      projectId: 'project1', // TODO: Get from config file
      projectPath: options.project
    };

    // Set up event handlers for progress updates
    client.on('stream', (msg: any) => {
      // Display progress updates during indexing
      if (msg.data.progress) {
        const { current, total, message } = msg.data.progress;
        process.stdout.write(`\r📊 ${message}: ${current}/${total} files processed`);
      }
    });

    client.on('response', (msg: any) => {
      if (msg.data.type === 'complete') {
        console.log('\n\n✅ Codebase indexing completed successfully!');
        console.log(`📈 ${msg.data.message}`);
        console.log('\n💡 Your codebase is now ready for planning and error analysis.');
        client.close();
      }
    });

    client.on('error', (msg: any) => {
      console.error('\n❌ Error during indexing:', msg.data.message);
      client.close();
    });

    // Send the indexing request
    client.send(request);
    
  } catch (error) {
    console.error('❌ Failed to connect to CodePlanner gateway:', error);
    console.log('\n🔧 Make sure the gateway is running:');
    console.log('   bun packages/gateway/src/server.ts');
    process.exit(1);
  }
}
