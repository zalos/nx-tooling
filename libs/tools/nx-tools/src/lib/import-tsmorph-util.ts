import { Tree } from '@nx/devkit';
import { Project, SourceFile, ImportDeclaration } from 'ts-morph';

/**
 * Utility class for managing imports in TypeScript/JavaScript files using TSMorph
 */
export class ImportTsMorphUtil {
  private sourceFile: SourceFile;
  private project: Project;
  private tree?: Tree;
  private filePath: string;

  constructor(sourceFile: SourceFile, filePath: string);
  constructor(tree: Tree, filePath: string);
  constructor(sourceFileOrTree: SourceFile | Tree, filePath: string) {
    this.filePath = filePath;
    
    if (this.isSourceFile(sourceFileOrTree)) {
      this.sourceFile = sourceFileOrTree;
      this.project = sourceFileOrTree.getProject();
    } else {
      this.tree = sourceFileOrTree;
      this.project = new Project();
      
      // Read file content from tree
      const content = this.tree.read(this.filePath)?.toString() || '';
      this.sourceFile = this.project.createSourceFile(this.filePath, content, { overwrite: true });
    }
  }

  private isSourceFile(obj: SourceFile | Tree): obj is SourceFile {
    return 'getProject' in obj;
  }

  /**
   * Ensure an import exists in the file
   * @param importSpecifier - The name being imported (e.g., 'logger', 'Component')
   * @param moduleSpecifier - The module path (e.g., '@nx/devkit', 'react')
   * @param importType - Type of import: 'named', 'default', 'namespace', or 'full'
   * 
   * Examples:
   * - ensureImport('logger', '@nx/devkit', 'named') → import { logger } from '@nx/devkit'
   * - ensureImport('React', 'react', 'default') → import React from 'react'
   * - ensureImport('fs', 'fs', 'namespace') → import * as fs from 'fs'
   * - ensureImport('', './config', 'full') → import './config'
   */
  ensureImport(
    importSpecifier: string, 
    moduleSpecifier: string, 
    importType: 'named' | 'default' | 'namespace' | 'full' = 'named'
  ): void {
    // Check if import already exists
    const existingImport = this.findImportDeclaration(moduleSpecifier);
    
    if (existingImport) {
      // Module is already imported, check if specifier exists
      if (importType === 'full' || this.hasImportSpecifier(existingImport, importSpecifier, importType)) {
        return; // Already exists
      }
      
      // Add specifier to existing import
      this.addSpecifierToImport(existingImport, importSpecifier, importType);
    } else {
      // Create new import declaration
      this.createImportDeclaration(importSpecifier, moduleSpecifier, importType);
    }
  }

  /**
   * Convenience method for full import syntax
   * @param fullImportStatement - Full import statement (e.g., "import * as fs from 'fs'")
   */
  ensureFullImport(fullImportStatement: string): void {
    const parsed = this.parseImportStatement(fullImportStatement);
    if (parsed) {
      this.ensureImport(parsed.specifier, parsed.module, parsed.type);
    }
  }

  /**
   * Remove an import specifier from the file
   * @param importSpecifier - The name being imported
   * @param moduleSpecifier - The module path
   * @param importType - Type of import
   */
  removeImport(
    importSpecifier: string, 
    moduleSpecifier: string, 
    importType: 'named' | 'default' | 'namespace' | 'full' = 'named'
  ): void {
    const importDeclaration = this.findImportDeclaration(moduleSpecifier);
    
    if (!importDeclaration) {
      return; // Import doesn't exist
    }

    if (importType === 'full') {
      // Remove entire import declaration
      importDeclaration.remove();
      return;
    }

    // Remove specific specifier
    const removed = this.removeSpecifierFromImport(importDeclaration, importSpecifier, importType);
    
    if (removed && this.isImportEmpty(importDeclaration)) {
      // Remove entire import if no specifiers left
      importDeclaration.remove();
    }
  }

  /**
   * Get all imports in the file
   */
  getImports(): Array<{
    module: string;
    specifiers: Array<{
      name: string;
      type: 'named' | 'default' | 'namespace';
      alias?: string;
    }>;
  }> {
    return this.sourceFile.getImportDeclarations().map(importDecl => ({
      module: importDecl.getModuleSpecifierValue(),
      specifiers: this.getImportSpecifiers(importDecl)
    }));
  }

  /**
   * Check if a specific import exists
   */
  hasImport(importSpecifier: string, moduleSpecifier: string, importType: 'named' | 'default' | 'namespace' | 'full' = 'named'): boolean {
    const importDeclaration = this.findImportDeclaration(moduleSpecifier);
    
    if (!importDeclaration) {
      return false;
    }

    if (importType === 'full') {
      return true; // Module import exists
    }

    return this.hasImportSpecifier(importDeclaration, importSpecifier, importType);
  }

  /**
   * Save changes back to file system
   */
  save(): void {
    if (this.tree) {
      this.tree.write(this.filePath, this.sourceFile.getFullText());
    } else {
      this.sourceFile.saveSync();
    }
  }

  /**
   * Get the updated file content
   */
  getContent(): string {
    return this.sourceFile.getFullText();
  }

  // Private helper methods

  private findImportDeclaration(moduleSpecifier: string): ImportDeclaration | undefined {
    return this.sourceFile.getImportDeclarations()
      .find(importDecl => importDecl.getModuleSpecifierValue() === moduleSpecifier);
  }

  private hasImportSpecifier(importDecl: ImportDeclaration, specifier: string, importType: 'named' | 'default' | 'namespace'): boolean {
    switch (importType) {
      case 'default':
        return importDecl.getDefaultImport()?.getText() === specifier;
      case 'namespace':
        return importDecl.getNamespaceImport()?.getText() === specifier;
      case 'named':
        return importDecl.getNamedImports().some(namedImport => 
          namedImport.getName() === specifier || namedImport.getAliasNode()?.getText() === specifier
        );
      default:
        return false;
    }
  }

  private addSpecifierToImport(importDecl: ImportDeclaration, specifier: string, importType: 'named' | 'default' | 'namespace'): void {
    switch (importType) {
      case 'default':
        if (!importDecl.getDefaultImport()) {
          importDecl.setDefaultImport(specifier);
        }
        break;
      case 'namespace':
        if (!importDecl.getNamespaceImport()) {
          importDecl.setNamespaceImport(specifier);
        }
        break;
      case 'named':
        if (!this.hasImportSpecifier(importDecl, specifier, 'named')) {
          importDecl.addNamedImport(specifier);
        }
        break;
    }
  }

  private createImportDeclaration(specifier: string, moduleSpecifier: string, importType: 'named' | 'default' | 'namespace' | 'full'): void {
    const importStructure: {
      moduleSpecifier: string;
      defaultImport?: string;
      namespaceImport?: string;
      namedImports?: string[];
    } = {
      moduleSpecifier
    };

    switch (importType) {
      case 'default':
        importStructure.defaultImport = specifier;
        break;
      case 'namespace':
        importStructure.namespaceImport = specifier;
        break;
      case 'named':
        importStructure.namedImports = [specifier];
        break;
      case 'full':
        // Just the module import
        break;
    }

    this.sourceFile.addImportDeclaration(importStructure);
  }

  private removeSpecifierFromImport(importDecl: ImportDeclaration, specifier: string, importType: 'named' | 'default' | 'namespace'): boolean {
    switch (importType) {
      case 'default':
        if (importDecl.getDefaultImport()?.getText() === specifier) {
          importDecl.removeDefaultImport();
          return true;
        }
        break;
      case 'namespace':
        if (importDecl.getNamespaceImport()?.getText() === specifier) {
          importDecl.removeNamespaceImport();
          return true;
        }
        break;
      case 'named': {
        const namedImport = importDecl.getNamedImports().find(ni => 
          ni.getName() === specifier || ni.getAliasNode()?.getText() === specifier
        );
        if (namedImport) {
          namedImport.remove();
          return true;
        }
        break;
      }
    }
    return false;
  }

  private isImportEmpty(importDecl: ImportDeclaration): boolean {
    return !importDecl.getDefaultImport() && 
           !importDecl.getNamespaceImport() && 
           importDecl.getNamedImports().length === 0;
  }

  private getImportSpecifiers(importDecl: ImportDeclaration): Array<{
    name: string;
    type: 'named' | 'default' | 'namespace';
    alias?: string;
  }> {
    const specifiers = [];

    // Default import
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      specifiers.push({
        name: defaultImport.getText(),
        type: 'default' as const
      });
    }

    // Namespace import
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) {
      specifiers.push({
        name: namespaceImport.getText(),
        type: 'namespace' as const
      });
    }

    // Named imports
    importDecl.getNamedImports().forEach(namedImport => {
      const alias = namedImport.getAliasNode();
      specifiers.push({
        name: namedImport.getName(),
        type: 'named' as const,
        ...(alias && { alias: alias.getText() })
      });
    });

    return specifiers;
  }

  private parseImportStatement(fullImportStatement: string): {
    specifier: string;
    module: string;
    type: 'named' | 'default' | 'namespace' | 'full';
  } | null {
    // Simple regex-based parsing for common import patterns
    const patterns = [
      { regex: /^import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/, type: 'default' as const },
      { regex: /^import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/, type: 'namespace' as const },
      { regex: /^import\s+\{\s*([^}]+)\s*\}\s+from\s+['"`]([^'"`]+)['"`]/, type: 'named' as const },
      { regex: /^import\s+['"`]([^'"`]+)['"`]/, type: 'full' as const }
    ];

    for (const pattern of patterns) {
      const match = fullImportStatement.trim().match(pattern.regex);
      if (match) {
        if (pattern.type === 'full') {
          return {
            specifier: '',
            module: match[1],
            type: pattern.type
          };
        }
        return {
          specifier: match[1].trim(),
          module: match[2],
          type: pattern.type
        };
      }
    }

    return null;
  }
}
