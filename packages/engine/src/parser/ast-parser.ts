/**
 * AST Parser for CodePlanner Engine
 * 
 * This module provides TypeScript AST parsing capabilities using ts-morph.
 * It extracts code chunks (functions, classes, interfaces) from TypeScript
 * projects and prepares them for embedding generation and semantic search.
 */

import { Project, SourceFile, FunctionDeclaration, ClassDeclaration, InterfaceDeclaration } from 'ts-morph';
import * as ts from 'typescript';
import type { CodeChunk } from '@codeplanner/shared';
import type { ASTParserConfig } from '../types';

/**
 * AST Parser for extracting code chunks from TypeScript projects
 * Uses ts-morph to parse TypeScript/JavaScript files and extract meaningful code structures
 */
export class ASTParser {
  private project: Project;
  private config: ASTParserConfig;

  constructor(config: ASTParserConfig) {
    this.config = config;
    
    // Initialize the TypeScript project with fallback compiler options if no tsconfig.json
    try {
      this.project = new Project({
        tsConfigFilePath: config.tsConfigPath || `${config.projectPath}/tsconfig.json`,
        skipAddingFilesFromTsConfig: false
      });
    } catch (error) {
      console.warn('⚠️  No tsconfig.json found, using default compiler options');
      this.project = new Project({
        compilerOptions: {
          allowJs: true,
          target: 99, // ts.ScriptTarget.ES2020
          module: 1, // ts.ModuleKind.CommonJS
          moduleResolution: 2, // ts.ModuleResolutionKind.NodeJs
          strict: true,
          skipLibCheck: true
        }
      });
    }
    
    // Add source files from the project path
    const projectPath = config.projectPath.startsWith('./') ? config.projectPath.slice(2) : config.projectPath;
    console.log(`🔍 Looking for source files in: ${projectPath}`);
    this.project.addSourceFilesAtPaths([
      `${projectPath}/**/*.ts`,
      `${projectPath}/**/*.tsx`,
      `${projectPath}/**/*.js`,
      `${projectPath}/**/*.jsx`
    ]);
  }

  /**
   * Parses the entire codebase and extracts code chunks
   * @returns Array of code chunks found in the project
   */
  parseCodebase(): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const sourceFiles = this.project.getSourceFiles();

    console.log(`📁 Found ${sourceFiles.length} source files to parse`);

    for (const file of sourceFiles) {
      // Skip node_modules unless explicitly included
      if (!this.config.includeNodeModules && file.getFilePath().includes('node_modules')) {
        continue;
      }

      // Skip files that don't match the configured extensions
      if (this.config.fileExtensions && !this.matchesFileExtension(file.getFilePath())) {
        continue;
      }

      try {
        const fileChunks = this.parseSourceFile(file);
        chunks.push(...fileChunks);
      } catch (error) {
        console.warn(`⚠️  Failed to parse file ${file.getFilePath()}:`, error);
      }
    }

    console.log(`📊 Extracted ${chunks.length} code chunks from ${sourceFiles.length} files`);
    return chunks;
  }

  /**
   * Parses a single source file and extracts code chunks
   * @param file - Source file to parse
   * @returns Array of code chunks from this file
   */
  private parseSourceFile(file: SourceFile): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const filePath = file.getFilePath();

    // Extract functions
    const functions = file.getFunctions();
    for (const func of functions) {
      if (func.getName()) {
        chunks.push({
          id: `func:${filePath}:${func.getName()}`,
          content: func.getText(),
          type: 'function',
          filePath,
          name: func.getName()
        });
      }
    }

    // Extract classes
    const classes = file.getClasses();
    for (const cls of classes) {
      if (cls.getName()) {
        chunks.push({
          id: `class:${filePath}:${cls.getName()}`,
          content: cls.getText(),
          type: 'class',
          filePath,
          name: cls.getName()
        });
      }
    }

    // Extract interfaces
    const interfaces = file.getInterfaces();
    for (const iface of interfaces) {
      if (iface.getName()) {
        chunks.push({
          id: `interface:${filePath}:${iface.getName()}`,
          content: iface.getText(),
          type: 'class', // Treat interfaces as classes for now
          filePath,
          name: iface.getName()
        });
      }
    }

    // If no specific structures found, include the entire file as a chunk
    if (chunks.length === 0 && this.shouldIncludeFile(file)) {
      chunks.push({
        id: `file:${filePath}`,
        content: file.getFullText(),
        type: 'file',
        filePath
      });
    }

    return chunks;
  }

  /**
   * Gets the content of a specific file
   * @param filePath - Path to the file
   * @returns File content or null if not found
   */
  getFileContent(filePath: string): string | null {
    try {
      const file = this.project.getSourceFile(filePath);
      return file?.getFullText() || null;
    } catch (error) {
      console.warn(`⚠️  Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Gets the content around a specific line in a file
   * @param filePath - Path to the file
   * @param lineNumber - Line number to get context around
   * @param contextLines - Number of lines before and after to include
   * @returns Context content or null if not found
   */
  getFileContext(filePath: string, lineNumber: number, contextLines: number = 10): string | null {
    const content = this.getFileContent(filePath);
    if (!content) return null;

    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);

    return lines.slice(start, end).join('\n');
  }

  /**
   * Checks if a file should be included in parsing
   * @param file - Source file to check
   * @returns true if file should be included
   */
  private shouldIncludeFile(file: SourceFile): boolean {
    const filePath = file.getFilePath();
    
    // Skip test files for now (can be made configurable)
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return false;
    }

    // Skip generated files
    if (filePath.includes('.generated.') || filePath.includes('.d.ts')) {
      return false;
    }

    return true;
  }

  /**
   * Checks if a file matches the configured file extensions
   * @param filePath - File path to check
   * @returns true if file extension matches
   */
  private matchesFileExtension(filePath: string): boolean {
    if (!this.config.fileExtensions) return true;
    
    return this.config.fileExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Gets statistics about the parsed project
   * @returns Project statistics
   */
  getProjectStats(): {
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalInterfaces: number;
  } {
    const sourceFiles = this.project.getSourceFiles();
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalInterfaces = 0;

    for (const file of sourceFiles) {
      if (!this.config.includeNodeModules && file.getFilePath().includes('node_modules')) {
        continue;
      }

      totalFunctions += file.getFunctions().length;
      totalClasses += file.getClasses().length;
      totalInterfaces += file.getInterfaces().length;
    }

    return {
      totalFiles: sourceFiles.length,
      totalFunctions,
      totalClasses,
      totalInterfaces
    };
  }
}
