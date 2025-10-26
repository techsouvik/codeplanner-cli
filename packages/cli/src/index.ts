#!/usr/bin/env bun

/**
 * Main CLI entry point for CodePlanner
 * 
 * This is the main entry point for the CodePlanner CLI application.
 * It sets up the command-line interface using Commander.js and
 * handles all user interactions.
 */

import { Command } from 'commander';
import { planCommand, analyzeErrorCommand, indexCommand } from './commands/command-index';

// Create the main CLI program
const program = new Command();

// Configure the main program
program
  .name('codeplanner')
  .description('AI-powered code planning and error analysis CLI tool')
  .version('0.1.0');

// Plan command - generates implementation plans
program
  .command('plan')
  .description('Generate a detailed implementation plan for your query')
  .argument('<query>', 'Your planning query (e.g., "Add user authentication")')
  .option('-p, --project <path>', 'Path to your project directory', './')
  .action(planCommand);

// Analyze error command - analyzes errors and provides debugging steps
program
  .command('analyze-error')
  .description('Analyze an error and generate debugging steps')
  .option('-e, --error <input>', 'Error input text (if not provided, will read from stdin)')
  .option('-t, --type <type>', 'Type of error (compiler, runtime, linter)', 'runtime')
  .option('-p, --project <path>', 'Path to your project directory', './')
  .action(analyzeErrorCommand);

// Index command - indexes the codebase for semantic search
program
  .command('index')
  .description('Index your codebase for semantic search and planning')
  .option('-p, --project <path>', 'Path to your project directory', './')
  .action(indexCommand);

// Parse command line arguments and execute the appropriate command
program.parse();

// Handle cases where no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
