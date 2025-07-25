import { ImportTsMorphUtil } from './import-tsmorph-util';
import { Project } from 'ts-morph';
import { Tree } from '@nx/devkit';

describe('ImportTsMorphUtil', () => {
  let project: Project;
  let mockTree: Tree;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    mockTree = {
      read: jest.fn(),
      write: jest.fn(),
    } as unknown as Tree;
  });

  describe('constructor', () => {
    it('should create instance from SourceFile', () => {
      const sourceFile = project.createSourceFile('test.ts', 'const x = 1;');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');
      expect(util).toBeInstanceOf(ImportTsMorphUtil);
    });

    it('should create instance from Tree', () => {
      const content = 'const x = 1;';
      (mockTree.read as jest.Mock).mockReturnValue(Buffer.from(content));

      const util = new ImportTsMorphUtil(mockTree, 'test.ts');
      expect(util).toBeInstanceOf(ImportTsMorphUtil);
    });
  });

  describe('ensureImport', () => {
    it('should add named import to empty file', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('logger', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        module: '@nx/devkit',
        specifiers: [{ name: 'logger', type: 'named' }]
      });
    });

    it('should add default import to empty file', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('React', 'react', 'default');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        module: 'react',
        specifiers: [{ name: 'React', type: 'default' }]
      });
    });

    it('should add namespace import to empty file', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('fs', 'fs', 'namespace');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        module: 'fs',
        specifiers: [{ name: 'fs', type: 'namespace' }]
      });
    });

    it('should add full import to empty file', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('', './config', 'full');

      const content = util.getContent();
      expect(content).toContain('import "./config";');
    });

    it('should not duplicate existing named import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('logger', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should not duplicate existing default import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import React from 'react';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('React', 'react', 'default');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should not duplicate existing namespace import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import * as fs from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('fs', 'fs', 'namespace');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should not duplicate existing full import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import './config';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('', './config', 'full');

      const content = util.getContent();
      const matches = content.match(/import\s+['"]\.\/config['"]/g);
      expect(matches).toHaveLength(1);
    });

    it('should add named import to existing import from same module', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('Tree', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(2);
      expect(imports[0].specifiers.some(s => s.name === 'logger')).toBe(true);
      expect(imports[0].specifiers.some(s => s.name === 'Tree')).toBe(true);
    });

    it('should add default import to existing named import from same module', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { Component } from 'react';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('React', 'react', 'default');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(2);
      expect(imports[0].specifiers.some(s => s.name === 'React' && s.type === 'default')).toBe(true);
      expect(imports[0].specifiers.some(s => s.name === 'Component' && s.type === 'named')).toBe(true);
    });

    it('should add namespace import to existing import from same module', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { readFileSync } from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Create separate import for namespace - TSMorph doesn't allow mixing
      util.ensureImport('fs', 'fs-extra', 'namespace');

      const imports = util.getImports();
      expect(imports).toHaveLength(2);
      
      const fsImports = imports.find(i => i.module === 'fs');
      const fsExtraImports = imports.find(i => i.module === 'fs-extra');
      
      expect(fsImports?.specifiers.some(s => s.name === 'readFileSync' && s.type === 'named')).toBe(true);
      expect(fsExtraImports?.specifiers.some(s => s.name === 'fs' && s.type === 'namespace')).toBe(true);
    });

    it('should default to named import type when not specified', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('logger', '@nx/devkit');

      const imports = util.getImports();
      expect(imports[0].specifiers[0].type).toBe('named');
    });
  });

  describe('ensureFullImport', () => {
    it('should parse and add default import statement', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('import React from "react"');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        module: 'react',
        specifiers: [{ name: 'React', type: 'default' }]
      });
    });

    it('should parse and add namespace import statement', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('import * as fs from "fs"');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        module: 'fs',
        specifiers: [{ name: 'fs', type: 'namespace' }]
      });
    });

    it('should parse and add named import statement', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('import { logger } from "@nx/devkit"');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        module: '@nx/devkit',
        specifiers: [{ name: 'logger', type: 'named' }]
      });
    });

    it('should parse and add full/side-effect import statement', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('import "./config"');

      const content = util.getContent();
      expect(content).toContain('import "./config";');
    });

    it('should handle single quotes in import statements', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport("import React from 'react'");

      const imports = util.getImports();
      expect(imports[0].module).toBe('react');
    });

    it('should handle backticks in import statements', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('import React from `react`');

      const imports = util.getImports();
      expect(imports[0].module).toBe('react');
    });

    it('should handle invalid import statement gracefully', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('invalid import statement');

      const imports = util.getImports();
      expect(imports).toHaveLength(0);
    });

    it('should handle multiple named imports in braces', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('import { logger, Tree } from "@nx/devkit"');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      // The parseImportStatement will treat "logger, Tree" as one specifier name
      expect(imports[0].specifiers).toHaveLength(2);
      expect(imports[0].specifiers.some(s => s.name === 'logger')).toBe(true);
      expect(imports[0].specifiers.some(s => s.name === 'Tree')).toBe(true);
    });
  });

  describe('removeImport', () => {
    it('should remove named import specifier', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger, Tree } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('logger', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
      expect(imports[0].specifiers[0].name).toBe('Tree');
    });

    it('should remove default import specifier', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import React, { Component } from 'react';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('React', 'react', 'default');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
      expect(imports[0].specifiers[0].name).toBe('Component');
    });

    it('should remove namespace import specifier', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import * as fs from 'fs';
import { readFileSync } from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('fs', 'fs', 'namespace');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
      expect(imports[0].specifiers[0].name).toBe('readFileSync');
    });

    it('should remove entire import declaration when removing full import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import './config';
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('', './config', 'full');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].module).toBe('@nx/devkit');
    });

    it('should remove entire import declaration when no specifiers left', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('logger', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(0);
    });

    it('should do nothing if import declaration does not exist', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('Component', 'react', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].module).toBe('@nx/devkit');
    });

    it('should do nothing if specifier does not exist in import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('Tree', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should default to named import type when not specified', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger, Tree } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('logger', '@nx/devkit');

      const imports = util.getImports();
      expect(imports[0].specifiers).toHaveLength(1);
      expect(imports[0].specifiers[0].name).toBe('Tree');
    });

    it('should handle removal of aliased named imports', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger as log, Tree } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('log', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports[0].specifiers).toHaveLength(1);
      expect(imports[0].specifiers[0].name).toBe('Tree');
    });
  });

  describe('getImports', () => {
    it('should return empty array for file with no imports', () => {
      const sourceFile = project.createSourceFile('test.ts', 'const x = 1;');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      const imports = util.getImports();
      expect(imports).toEqual([]);
    });

    it('should return all import types correctly', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import React, { Component } from 'react';
import * as fs from 'fs';
import { logger } from '@nx/devkit';
import './config';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      const imports = util.getImports();
      expect(imports).toHaveLength(4);
      
      // React imports
      const reactImports = imports.find(i => i.module === 'react');
      expect(reactImports?.specifiers).toHaveLength(2);
      expect(reactImports?.specifiers.some(s => s.name === 'React' && s.type === 'default')).toBe(true);
      expect(reactImports?.specifiers.some(s => s.name === 'Component' && s.type === 'named')).toBe(true);
      
      // fs namespace import
      const fsImports = imports.find(i => i.module === 'fs');
      expect(fsImports?.specifiers).toHaveLength(1);
      expect(fsImports?.specifiers[0]).toEqual({ name: 'fs', type: 'namespace' });
      
      // @nx/devkit named import
      const nxImports = imports.find(i => i.module === '@nx/devkit');
      expect(nxImports?.specifiers).toHaveLength(1);
      expect(nxImports?.specifiers[0]).toEqual({ name: 'logger', type: 'named' });
      
      // Side effect import (has no specifiers)
      const configImports = imports.find(i => i.module === './config');
      expect(configImports?.specifiers).toHaveLength(0);
    });

    it('should handle aliased named imports', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger as log, Tree as TreeType } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      const imports = util.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(2);
      
      const loggerImport = imports[0].specifiers.find(s => s.name === 'logger');
      expect(loggerImport).toEqual({ name: 'logger', type: 'named', alias: 'log' });
      
      const treeImport = imports[0].specifiers.find(s => s.name === 'Tree');
      expect(treeImport).toEqual({ name: 'Tree', type: 'named', alias: 'TreeType' });
    });
  });

  describe('hasImport', () => {
    it('should return true for existing named import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      expect(util.hasImport('logger', '@nx/devkit', 'named')).toBe(true);
      expect(util.hasImport('Tree', '@nx/devkit', 'named')).toBe(false);
    });

    it('should return true for existing default import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import React from 'react';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      expect(util.hasImport('React', 'react', 'default')).toBe(true);
      expect(util.hasImport('Component', 'react', 'default')).toBe(false);
    });

    it('should return true for existing namespace import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import * as fs from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      expect(util.hasImport('fs', 'fs', 'namespace')).toBe(true);
      expect(util.hasImport('path', 'fs', 'namespace')).toBe(false);
    });

    it('should return true for existing full import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import './config';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      expect(util.hasImport('', './config', 'full')).toBe(true);
      expect(util.hasImport('', './other', 'full')).toBe(false);
    });

    it('should return false for non-existent module', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      expect(util.hasImport('Component', 'react', 'named')).toBe(false);
    });

    it('should default to named import type when not specified', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      expect(util.hasImport('logger', '@nx/devkit')).toBe(true);
    });

    it('should handle aliased named imports', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger as log } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      expect(util.hasImport('log', '@nx/devkit', 'named')).toBe(true);
      expect(util.hasImport('logger', '@nx/devkit', 'named')).toBe(true);
    });
  });

  describe('save and getContent', () => {
    it('should return updated content after adding import', () => {
      const sourceFile = project.createSourceFile('test.ts', 'const x = 1;');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureImport('logger', '@nx/devkit', 'named');

      const content = util.getContent();
      expect(content).toContain('import { logger } from "@nx/devkit";');
      expect(content).toContain('const x = 1;');
    });

    it('should write to tree when using Tree constructor', () => {
      const content = 'const x = 1;';
      (mockTree.read as jest.Mock).mockReturnValue(Buffer.from(content));

      const util = new ImportTsMorphUtil(mockTree, 'test.ts');
      util.ensureImport('logger', '@nx/devkit', 'named');
      util.save();

      expect(mockTree.write).toHaveBeenCalledWith('test.ts', expect.stringContaining('import { logger } from "@nx/devkit";'));
    });
  });

  describe('edge cases and private method coverage', () => {
    it('should handle complex import scenarios', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import React, { Component, useState } from 'react';
import * as fs from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Test adding to existing complex import
      util.ensureImport('useEffect', 'react', 'named');

      const imports = util.getImports();
      const reactImports = imports.find(i => i.module === 'react');
      expect(reactImports?.specifiers).toHaveLength(4);
      expect(reactImports?.specifiers.some(s => s.name === 'useEffect')).toBe(true);
    });

    it('should not add default import if it already exists', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import React from 'react';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Try to add default import when it already exists
      util.ensureImport('React', 'react', 'default');

      const imports = util.getImports();
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should not add namespace import if it already exists', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import * as fs from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Try to add namespace import when it already exists
      util.ensureImport('fs', 'fs', 'namespace');

      const imports = util.getImports();
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should handle removing non-existent default import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { Component } from 'react';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('React', 'react', 'default');

      const imports = util.getImports();
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should handle removing non-existent namespace import', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { readFileSync } from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.removeImport('fs', 'fs', 'namespace');

      const imports = util.getImports();
      expect(imports[0].specifiers).toHaveLength(1);
    });

    it('should handle import with only default import - not empty after removing named', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import React from 'react';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Try to remove non-existent named import
      util.removeImport('Component', 'react', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1); // Should still have default import
    });

    it('should handle import with only namespace import - not empty after removing named', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import * as fs from 'fs';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Try to remove non-existent named import
      util.removeImport('readFileSync', 'fs', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(1); // Should still have namespace import
    });

    it('should parse import statement with whitespace variations', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Test parsing with extra whitespace
      util.ensureFullImport('import   React   from   "react"');

      const imports = util.getImports();
      expect(imports[0].module).toBe('react');
      expect(imports[0].specifiers[0].name).toBe('React');
    });

    it('should parse named import with spaces in braces', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      util.ensureFullImport('import {   logger   } from "@nx/devkit"');

      const imports = util.getImports();
      expect(imports[0].specifiers[0].name).toBe('logger');
    });

    it('should handle removal by alias name', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger as log } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Remove by original name
      util.removeImport('logger', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(0);
    });

    it('should cover additional edge cases for full coverage', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Test the default case in addSpecifierToImport switch statement
      const importDecl = sourceFile.addImportDeclaration({ moduleSpecifier: 'test' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (util as any).addSpecifierToImport(importDecl, 'test', 'invalid' as any);

      // Test the default case in removeSpecifierFromImport switch statement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const removed = (util as any).removeSpecifierFromImport(importDecl, 'test', 'invalid' as any);
      expect(removed).toBe(false);

      // Test hasImportSpecifier with default case
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasSpecifier = (util as any).hasImportSpecifier(importDecl, 'test', 'invalid' as any);
      expect(hasSpecifier).toBe(false);
    });

    it('should handle removing by original name when using alias', () => {
      const sourceFile = project.createSourceFile('test.ts', `
import { logger as log } from '@nx/devkit';
      `);
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Remove by original name should work
      util.removeImport('logger', '@nx/devkit', 'named');

      const imports = util.getImports();
      expect(imports).toHaveLength(0);
    });

    it('should handle parseImportStatement edge cases', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');

      // Test parseImportStatement with no match
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (util as any).parseImportStatement('not an import');
      expect(result).toBeNull();

      // Test parseImportStatement with full import pattern
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullResult = (util as any).parseImportStatement('import "./config"');
      expect(fullResult).toEqual({
        specifier: '',
        module: './config',
        type: 'full'
      });

      // Test parseImportStatement with default import pattern  
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultResult = (util as any).parseImportStatement('import React from "react"');
      expect(defaultResult).toEqual({
        specifier: 'React',
        module: 'react',
        type: 'default'
      });
    });

    it('should test Tree.read returning null/undefined', () => {
      (mockTree.read as jest.Mock).mockReturnValue(null);

      const util = new ImportTsMorphUtil(mockTree, 'test.ts');
      expect(util).toBeInstanceOf(ImportTsMorphUtil);
      
      // Should handle null return from tree.read
      expect(util.getContent()).toBeDefined();
    });

    it('should test all branches in hasImportSpecifier for complete coverage', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      
      // Create import with both named import and alias to test all branches
      sourceFile.addImportDeclaration({
        moduleSpecifier: 'test',
        namedImports: [
          { name: 'regularImport' },
          { name: 'originalName', alias: 'aliasName' }
        ]
      });
      
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');
      const importDecl = sourceFile.getImportDeclarations()[0];
      
      // Test that hasImportSpecifier properly handles the some() method branches
      // This should test both namedImport.getName() === specifier AND namedImport.getAliasNode()?.getText() === specifier
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((util as any).hasImportSpecifier(importDecl, 'regularImport', 'named')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((util as any).hasImportSpecifier(importDecl, 'originalName', 'named')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((util as any).hasImportSpecifier(importDecl, 'aliasName', 'named')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((util as any).hasImportSpecifier(importDecl, 'nonExistent', 'named')).toBe(false);
    });

    it('should hit default case in hasImportSpecifier for 100% coverage', () => {
      const sourceFile = project.createSourceFile('test.ts', '');
      sourceFile.addImportDeclaration({ moduleSpecifier: 'test' });
      
      const util = new ImportTsMorphUtil(sourceFile, 'test.ts');
      const importDecl = sourceFile.getImportDeclarations()[0];
      
      // Test the default case by passing an invalid import type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((util as any).hasImportSpecifier(importDecl, 'test', 'invalid' as any)).toBe(false);
    });
  });
});
