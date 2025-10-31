/**
 * Analyze error command implementation for CodePlanner CLI
 * 
 * This module handles the 'analyze-error' command which analyzes
 * errors and generates debugging plans with step-by-step fixes.
 */

import { CodePlannerClient } from '../client/websocket';
import type { PlanRequest } from '@codeplanner/shared';

/**
 * Handles the analyze-error command execution
 * Connects to the gateway and requests error analysis
 * @param options - Command line options
 */
export async function analyzeErrorCommand(options: any) {
  console.log('🐛 Analyzing error and generating debugging plan...\n');
  
  let errorInput: string;
  
  // Get error input from command line option or stdin
  if (options.error) {
    errorInput = options.error;
    console.log(`📝 Error input: ${errorInput}`);
  } else {
    // Read error from stdin if not provided as option
    console.log('📝 Paste your error below (press Ctrl+D when done):');
    console.log('   (You can paste compiler errors, runtime errors, or linter warnings)\n');
    
    try {
      errorInput = await Bun.stdin.text();
    } catch (error) {
      console.error('❌ Failed to read error input from stdin');
      process.exit(1);
    }
  }

  if (!errorInput.trim()) {
    console.error('❌ No error input provided');
    process.exit(1);
  }

  console.log(`📁 Project: ${options.project}`);
  console.log(`🔍 Error type: ${options.type}\n`);
  
  const client = new CodePlannerClient();
  
  try {
    // Connect to the WebSocket gateway
    await client.connect();
    
    // Prepare the error analysis request
    const request: PlanRequest = {
      command: 'analyze-error',
      userId: 'user1', // TODO: Get from config file
      projectId: 'project1', // TODO: Get from config file
      projectPath: options.project,
      errorInput: errorInput.trim(),
      errorType: options.type
    };

    // Set up event handlers for streaming responses
    client.on('stream', (msg: any) => {
      // Stream the debugging plan content as it's generated
      process.stdout.write(
        typeof msg.data.chunk === 'string' ? msg.data.chunk : JSON.stringify(msg.data.chunk)
      );
    });

    client.on('response', (msg: any) => {
      console.log('\n\n✅ Debugging plan generated successfully!');
      console.log('\n🔧 Follow the steps above to resolve the error.');
      client.close();
    });

    client.on('error', (msg: any) => {
      console.error('\n❌ Error analyzing error:', msg.data.message);
      client.close();
    });

    // Send the error analysis request
    client.send(request);
    
  } catch (error) {
    console.error('❌ Failed to connect to CodePlanner gateway:', error);
    console.log('\n🔧 Make sure the gateway is running:');
    console.log('   bun packages/gateway/src/server.ts');
    process.exit(1);
  }
}
