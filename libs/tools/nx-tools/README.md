# Nx Tools - ESLint & Import Utilities

A comprehensive TypeScript/JavaScript utility library for programmatically managing ESLint flat configurations and import statements using TSMorph AST manipulation.

## Features

- **ESLint Flat Config Management**: Add, update, and remove ESLint configurations programmatically
- **Import Management**: Ensure, remove, and manage TypeScript/JavaScript imports with full type support
- **TSMorph Integration**: Leverage the power of TypeScript AST manipulation
- **Nx Tree Support**: Works seamlessly with Nx workspace file operations
- **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @your-scope/nx-tools
# or
pnpm add @your-scope/nx-tools
# or  
yarn add @your-scope/nx-tools
```

## Quick Start

### ESLint Configuration Management

```typescript
import { EslintTsMorphUtil } from '@your-scope/nx-tools';
import { Tree } from '@nx/devkit';

// Initialize utility
const eslintUtil = new EslintTsMorphUtil(tree, 'eslint.config.mjs');

// Add or update configuration
eslintUtil.addOrUpdateConfig({
  files: ['**/*.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn'
  }
});

// Save changes
eslintUtil.save();
```

### Common Use Case: Playwright E2E Configuration

```typescript
// Add Playwright configuration with spread operators
eslintUtil.addOrUpdateConfig({
  files: ['tests/**'],
  '...playwright.configs[\'flat/recommended\']': true,
  rules: {
    '...playwright.configs[\'flat/recommended\'].rules': true,
    // Customize Playwright rules
    'playwright/expect-expect': 'error'
  }
});

eslintUtil.save();
```

### Import Management

```typescript
import { ImportTsMorphUtil } from '@your-scope/nx-tools';

// Initialize with file content
const importUtil = new ImportTsMorphUtil(tree, 'src/app.ts');

// Add various types of imports
importUtil.ensureImport('logger', '@nx/devkit', 'named');         // import { logger } from '@nx/devkit'
importUtil.ensureImport('React', 'react', 'default');             // import React from 'react'
importUtil.ensureImport('fs', 'fs', 'namespace');                 // import * as fs from 'fs'
importUtil.ensureImport('', './config', 'full');                  // import './config'

// Save changes
importUtil.save();
```

## ESLint Configuration Examples

### Basic Rule Management

```typescript
const eslintUtil = new EslintTsMorphUtil(tree, 'eslint.config.mjs');

// Add a single rule
eslintUtil.addRule(['**/*.ts'], 'no-console', 'warn');
```

**Before:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  }
];
```

**After:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'warn'
    }
  }
];
```

```typescript
// Add multiple rules at once
eslintUtil.addRules('**/*.ts', {
  'no-console': 'warn',
  'prefer-const': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
});
```

**Before:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    }
  }
];
```

**After:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      'no-console': 'warn',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
];
```

```typescript
// Update existing rule
eslintUtil.updateRule(['**/*.ts'], 'no-console', 'error');

// Remove a rule
eslintUtil.removeRule(['**/*.ts'], 'no-console');

// Check if rule exists
if (eslintUtil.hasRule('**/*.ts', 'no-console')) {
  console.log('Rule exists!');
}

// Get rule configuration
const ruleConfig = eslintUtil.getRule('**/*.ts', 'no-console');
console.log(ruleConfig); // 'error' | ['error', options] | etc.
```

### Complex Configuration Scenarios

#### Angular Project Setup

```typescript
// Set up ESLint for Angular components
eslintUtil.addOrUpdateConfig({
  files: ['**/*.component.ts'],
  extends: ['@angular-eslint/recommended'],
  rules: {
    '@angular-eslint/component-selector': [
      'error',
      {
        type: 'element',
        prefix: 'app',
        style: 'kebab-case'
      }
    ],
    '@angular-eslint/directive-selector': [
      'error',
      {
        type: 'attribute',
        prefix: 'app',
        style: 'camelCase'
      }
    ]
  }
});
```

**Before:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  }
];
```

**After:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  },
  {
    files: ['**/*.component.ts'],
    extends: ['@angular-eslint/recommended'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case'
        }
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase'
        }
      ]
    }
  }
];
```

```typescript
// Configure template files
eslintUtil.addOrUpdateConfig({
  files: ['**/*.component.html'],
  extends: ['@angular-eslint/template/recommended'],
  rules: {
    '@angular-eslint/template/no-negated-async': 'error'
  }
});
```

**Before (after previous change):**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  },
  {
    files: ['**/*.component.ts'],
    extends: ['@angular-eslint/recommended'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case'
        }
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase'
        }
      ]
    }
  }
];
```

**After:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  },
  {
    files: ['**/*.component.ts'],
    extends: ['@angular-eslint/recommended'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case'
        }
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase'
        }
      ]
    }
  },
  {
    files: ['**/*.component.html'],
    extends: ['@angular-eslint/template/recommended'],
    rules: {
      '@angular-eslint/template/no-negated-async': 'error'
    }
  }
];
```

#### React + TypeScript Configuration

```typescript
// React TypeScript configuration
eslintUtil.addOrUpdateConfig(['**/*.tsx', '**/*.jsx'], {
  languageOptions: {
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: {
        jsx: true
      }
    }
  },
  plugins: ['react', 'react-hooks', '@typescript-eslint'],
  rules: {
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn'
  }
});
```

#### Test File Configuration

```typescript
// Jest test configuration
eslintUtil.addOrUpdateConfig(['**/*.spec.ts', '**/*.test.ts'], {
  env: {
    jest: true
  },
  extends: ['plugin:jest/recommended'],
  rules: {
    'jest/expect-expect': 'error',
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/valid-expect': 'error'
  }
});

// Playwright E2E tests
eslintUtil.addOrUpdateConfig({
  files: ['**/*.e2e-spec.ts'],
  extends: ['plugin:playwright/playwright-test'],
  rules: {
    'playwright/expect-expect': 'error',
    'playwright/no-conditional-in-test': 'warn'
  }
});
```

#### Using Spread Operator for Configuration Extension

```typescript
// Simple Playwright configuration with modern flat config syntax
eslintUtil.addOrUpdateConfig({
  files: ['tests/**'],
  '...playwright.configs[\'flat/recommended\']': true,
  rules: {
    '...playwright.configs[\'flat/recommended\'].rules': true,
    // Customize Playwright rules
    'playwright/expect-expect': 'error',
    'playwright/no-conditional-in-test': 'warn'
  }
});
```

```typescript
// Advanced Playwright configuration using spread operator (recommended approach)
eslintUtil.addOrUpdateConfig({
  files: ['**/*.e2e-spec.ts', 'e2e/**/*.ts'],
  // Use spread operator to extend existing configurations
  '...playwright.configs.recommended': true,
  languageOptions: {
    parser: '@typescript-eslint/parser'
  },
  rules: {
    'playwright/expect-expect': 'error',
    'playwright/no-conditional-in-test': 'warn',
    'playwright/no-skipped-test': 'error'
  }
});
```

**Before:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  }
];
```

**After:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  },
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Customize Playwright rules
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'warn'
    }
  }
];
```

```typescript
// You can also combine multiple spread configurations
eslintUtil.addOrUpdateConfig(['**/*.tsx', '**/*.jsx'], {
  '...@typescript-eslint/recommended': true,
  '...react.configs.recommended': true,
  '...react.configs.jsx-runtime': true,
  languageOptions: {
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: { jsx: true }
    }
  },
  rules: {
    'react/prop-types': 'off', // TypeScript handles this
    '@typescript-eslint/no-unused-vars': 'error'
  }
});
```

**Before:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'prefer-const': 'error'
    }
  }
];
```

**After:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'prefer-const': 'error'
    }
  },
  {
    ...require('@typescript-eslint/eslint-plugin').configs.recommended,
    ...require('eslint-plugin-react').configs.recommended,
    ...require('eslint-plugin-react').configs['jsx-runtime'],
    files: ['**/*.tsx', '**/*.jsx'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': 'error'
    }
  }
];
```

### Advanced Configuration Management

```typescript
// Get all current configurations
const configs = eslintUtil.getConfigs();
console.log(configs);

// Remove a configuration entirely
eslintUtil.removeConfig(['**/*.spec.ts']);

// Add configuration with complex language options
eslintUtil.addOrUpdateConfig({
  files: ['**/*.ts'],
  languageOptions: {
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: process.cwd()
    },
    globals: {
      MyGlobal: 'readonly'
    }
  },
  plugins: {
    '@typescript-eslint': require('@typescript-eslint/eslint-plugin')
  }
});

### Spread Operator Support

The `EslintTsMorphUtil` supports spread operators for both configuration objects and rules sections, allowing you to extend base configurations cleanly.

#### Adding Spread Operators to Rules

```typescript
// Add spread operator to rules section
eslintUtil.addSpreadToRules(['**/*.ts'], 'baseTypeScriptRules');

// Remove spread operator from rules section  
eslintUtil.removeSpreadFromRules(['**/*.ts'], 'baseTypeScriptRules');
```

**Before:**
```javascript
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
```

**After adding spread to rules:**
```javascript
export default [
  {
    files: ['**/*.ts'],
    rules: {
      ...baseTypeScriptRules,
      'no-console': 'error'
    }
  }
];
```

#### Adding Spread Operators to Config Objects

```typescript
// Add spread operator to config object level
eslintUtil.addSpreadToConfig(['**/*.ts'], 'baseConfig');

// Remove spread operator from config object level
eslintUtil.removeSpreadFromConfig(['**/*.ts'], 'baseConfig');
```

**Before:**
```javascript
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
```

**After adding spread to config:**
```javascript
export default [
  {
    ...baseConfig,
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
```

#### Automatic Spread Operator Parsing

The utility automatically parses and preserves existing spread operators when reading configurations:

```typescript
// Original config with spread operators
const configWithSpreads = `
export default [
  {
    ...baseConfig,
    files: ['**/*.ts'],
    rules: {
      ...commonRules,
      'no-console': 'error',
      ...projectSpecificRules
    }
  }
];
`;

const util = new EslintTsMorphUtil(tree, 'eslint.config.mjs');
const configs = util.getConfigs();

// Spread operators are preserved in the parsed configuration
console.log(configs[0]['...baseConfig']); // undefined (placeholder)
console.log(configs[0].rules['...commonRules']); // null (placeholder)
console.log(configs[0].rules['...projectSpecificRules']); // null (placeholder)
console.log(configs[0].rules['no-console']); // 'error'
```

// Modern flat config with spread operator for extending configurations
eslintUtil.addOrUpdateConfig({
  files: ['**/*.ts'],
  // Spread operator usage for extending configurations
  '...@typescript-eslint/recommended': true,
  '...@typescript-eslint/recommended-requiring-type-checking': true,
  languageOptions: {
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: true
    }
  },
  rules: {
    // Override specific rules from the extended configs
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn'
  }
});
```

## Import Management Examples

### Basic Import Operations

```typescript
const importUtil = new ImportTsMorphUtil(sourceFile, 'src/app.ts');

// Named imports
importUtil.ensureImport('Component', '@angular/core', 'named');
// Result: import { Component } from '@angular/core';
```

**Before:**
```typescript
// src/app.ts
console.log('Hello World');
```

**After:**
```typescript
// src/app.ts
import { Component } from '@angular/core';

console.log('Hello World');
```

```typescript
// Default imports  
importUtil.ensureImport('React', 'react', 'default');
// Result: import React from 'react';
```

**Before:**
```typescript
// src/app.ts
import { Component } from '@angular/core';

console.log('Hello World');
```

**After:**
```typescript
// src/app.ts
import { Component } from '@angular/core';
import React from 'react';

console.log('Hello World');
```

```typescript
// Namespace imports
importUtil.ensureImport('fs', 'fs', 'namespace'); 
// Result: import * as fs from 'fs';

// Side-effect imports
importUtil.ensureImport('', './polyfills', 'full');
// Result: import './polyfills';
```

**Before:**
```typescript
// src/app.ts
import { Component } from '@angular/core';
import React from 'react';

console.log('Hello World');
```

**After:**
```typescript
// src/app.ts
import { Component } from '@angular/core';
import React from 'react';
import * as fs from 'fs';
import './polyfills';

console.log('Hello World');
```

### Advanced Import Scenarios

#### Combining Multiple Import Types

```typescript
// Add multiple specifiers to the same module
importUtil.ensureImport('Component', '@angular/core', 'named');
importUtil.ensureImport('Input', '@angular/core', 'named');
importUtil.ensureImport('Output', '@angular/core', 'named');
// Result: import { Component, Input, Output } from '@angular/core';
```

**Before:**
```typescript
// src/component.ts
export class MyComponent {
  
}
```

**After:**
```typescript
// src/component.ts
import { Component, Input, Output } from '@angular/core';

export class MyComponent {
  
}
```

```typescript
// Mix default and named imports
importUtil.ensureImport('React', 'react', 'default');
importUtil.ensureImport('useState', 'react', 'named');
importUtil.ensureImport('useEffect', 'react', 'named');
// Result: import React, { useState, useEffect } from 'react';
```

**Before:**
```typescript
// src/hooks.ts
export function useCustomHook() {
  
}
```

**After:**
```typescript
// src/hooks.ts
import React, { useState, useEffect } from 'react';

export function useCustomHook() {
  
}
```

#### Import from Full Statements

```typescript
// Parse and add from full import statements
importUtil.ensureFullImport("import { Observable } from 'rxjs'");
importUtil.ensureFullImport("import * as lodash from 'lodash'");
importUtil.ensureFullImport("import './styles.css'");

// Handles various quote styles
importUtil.ensureFullImport('import { map } from "rxjs/operators"');
importUtil.ensureFullImport(`import { filter } from \`rxjs/operators\``);
```

#### Import Removal

```typescript
// Remove specific import specifiers
importUtil.removeImport('Component', '@angular/core', 'named');
importUtil.removeImport('React', 'react', 'default');
importUtil.removeImport('fs', 'fs', 'namespace');
```

**Before:**
```typescript
// src/app.ts
import { Component, Input, Output } from '@angular/core';
import React, { useState, useEffect } from 'react';
import * as fs from 'fs';
import './polyfills';

export class MyApp {
  
}
```

**After:**
```typescript
// src/app.ts
import { Input, Output } from '@angular/core';
import { useState, useEffect } from 'react';
import './polyfills';

export class MyApp {
  
}
```

```typescript
// Remove entire import (side-effect)
importUtil.removeImport('', './polyfills', 'full');

// Automatic cleanup - removes entire import declaration if no specifiers remain
importUtil.removeImport('useState', 'react', 'named'); // If this was the last specifier
// The entire import line gets removed
```

**Before:**
```typescript
// src/app.ts
import { Input, Output } from '@angular/core';
import { useState, useEffect } from 'react';
import './polyfills';

export class MyApp {
  
}
```

**After (removing side-effect and one more specifier):**
```typescript
// src/app.ts
import { Input, Output } from '@angular/core';
import { useEffect } from 'react';

export class MyApp {
  
}
```

**After (removing the last specifier from react):**
```typescript
// src/app.ts
import { Input, Output } from '@angular/core';

export class MyApp {
  
}
```

### Import Inspection and Management

```typescript
// Check if import exists
if (importUtil.hasImport('Component', '@angular/core', 'named')) {
  console.log('Component is already imported');
}

// Get all imports in the file
const allImports = importUtil.getImports();
console.log(allImports);
/*
[
  {
    module: '@angular/core',
    specifiers: [
      { name: 'Component', type: 'named' },
      { name: 'Input', type: 'named' }
    ]
  },
  {
    module: 'react',
    specifiers: [
      { name: 'React', type: 'default' },
      { name: 'useState', type: 'named', alias: 'state' }
    ]
  }
]
*/

// Handle aliased imports
importUtil.ensureImport('useState', 'react', 'named'); // import { useState } from 'react'
// Check by original name or alias
importUtil.hasImport('useState', 'react', 'named'); // true
importUtil.hasImport('state', 'react', 'named'); // true if aliased as 'state'
```

## Helper Methods and Utilities

### ESLint Helper Methods

```typescript
const eslintUtil = new EslintTsMorphUtil(tree, 'eslint.config.mjs');

// Add TypeScript recommended rules
eslintUtil.addTypeScriptRules('**/*.ts');

// Remove deprecated rules
eslintUtil.removeDeprecatedRules(['**/*.ts', '**/*.js']);

// Bulk operations
eslintUtil.addRules('**/*.ts', {
  'no-console': 'warn',
  'prefer-const': 'error',
  '@typescript-eslint/no-unused-vars': 'error'
});
```

### File Content Management

```typescript
// Get updated content without saving
const updatedContent = eslintUtil.getContent();
console.log(updatedContent);

// Save to file system (Nx Tree or direct file)
eslintUtil.save();

// For import utilities
const importContent = importUtil.getContent();
importUtil.save();
```

## Integration Examples

### Nx Generator Integration

```typescript
import { Tree, formatFiles } from '@nx/devkit';
import { EslintTsMorphUtil, ImportTsMorphUtil } from '@your-scope/nx-tools';

export default async function myGenerator(tree: Tree, options: MyGeneratorOptions) {
  // Configure ESLint for new project
  const eslintUtil = new EslintTsMorphUtil(tree, `${options.projectRoot}/eslint.config.mjs`);
  
  eslintUtil.addOrUpdateConfig({
    files: ['**/*.ts'],
    extends: ['@typescript-eslint/recommended'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'error'
    }
  });

  // Add imports to main file
  const mainFile = `${options.projectRoot}/src/main.ts`;
  const importUtil = new ImportTsMorphUtil(tree, mainFile);
  
  importUtil.ensureImport('bootstrapApplication', '@angular/platform-browser', 'named');
  importUtil.ensureImport('AppComponent', './app/app.component', 'named');

  // Save all changes
  eslintUtil.save();
  importUtil.save();
  
  await formatFiles(tree);
}
```

### Migration Script Example

```typescript
// Migrate from old ESLint config to flat config
import { EslintTsMorphUtil } from '@your-scope/nx-tools';

function migrateEslintConfig(tree: Tree, projectPath: string) {
  const eslintUtil = new EslintTsMorphUtil(tree, `${projectPath}/eslint.config.mjs`);
  
  // Remove old configurations
  eslintUtil.removeConfig(['**/*.js']);
  
  // Add new modern configurations
  eslintUtil.addOrUpdateConfig({
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin')
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn'
    }
  });
  
  eslintUtil.save();
}
```

### Real-World Playwright E2E Configuration

```typescript
// Set up comprehensive Playwright configuration with spread operator
function setupPlaywrightEslint(tree: Tree, projectPath: string) {
  const eslintUtil = new EslintTsMorphUtil(tree, `${projectPath}/eslint.config.mjs`);
  
  // Add Playwright E2E configuration using spread operator
  eslintUtil.addOrUpdateConfig(['**/*.e2e-spec.ts', 'e2e/**/*.ts'], {
    // Extend Playwright's recommended configuration
    '...playwright.configs.recommended': true,
    
    // Additional language options for TypeScript
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './e2e/tsconfig.json'
      }
    },
    
    // Custom rules that override or extend the base config
    rules: {
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'warn',
      'playwright/no-skipped-test': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/prefer-to-have-length': 'error',
      
      // TypeScript-specific overrides for test files
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      '@typescript-eslint/explicit-function-return-type': 'off' // Not needed in tests
    },
    
    // Test-specific globals
    languageOptions: {
      globals: {
        test: 'readonly',
        expect: 'readonly',
        page: 'readonly',
        context: 'readonly'
      }
    }
  });
  
  eslintUtil.save();
}
```

**Before:**
```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'prefer-const': 'warn'
    }
  }
];
```

**After:**
```javascript
// eslint.config.mjs
import playwright from 'eslint-plugin-playwright';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'prefer-const': 'warn'
    }
  },
  {
    ...playwright.configs.recommended,
    files: ['**/*.e2e-spec.ts', 'e2e/**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './e2e/tsconfig.json'
      },
      globals: {
        test: 'readonly',
        expect: 'readonly',
        page: 'readonly',
        context: 'readonly'
      }
    },
    rules: {
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'warn',
      'playwright/no-skipped-test': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/prefer-to-have-length': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
];
```

```typescript
// Usage in generator
export default async function e2eGenerator(tree: Tree, options: E2EGeneratorOptions) {
  setupPlaywrightEslint(tree, options.projectRoot);
  await formatFiles(tree);
}
```

## API Reference

### EslintTsMorphUtil

#### Constructor
- `new EslintTsMorphUtil(sourceFile: SourceFile)`: Create from SourceFile (filePath auto-detected)
- `new EslintTsMorphUtil(sourceFile: SourceFile, filePath: string)`: Create from SourceFile with custom path
- `new EslintTsMorphUtil(tree: Tree, filePath: string)`: Create from Tree (filePath required)

#### Methods
- `getConfigs()`: Get all configurations
- `addOrUpdateConfig(config: EslintConfigObject)`: Add or update configuration
- `removeConfig(filePattern: string[])`: Remove configuration
- `addRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig)`: Add single rule
- `addMultipleRules(filePattern: string[], rules: Record<string, EslintRuleConfig>)`: Add multiple rules
- `removeRule(filePattern: string[], ruleName: string)`: Remove rule
- `removeMultipleRules(filePattern: string[], ruleNames: string[])`: Remove multiple rules
- `updateRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig)`: Update rule
- `ensureRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig)`: Ensure rule exists with config
- `removeRuleIfExists(filePattern: string[], ruleName: string)`: Remove rule if it exists
- `hasRule(filePattern: string[], ruleName: string): boolean`: Check if rule exists
- `addSpreadToRules(filePattern: string[], spreadExpression: string)`: Add spread operator to rules section
- `removeSpreadFromRules(filePattern: string[], spreadExpression: string)`: Remove spread operator from rules section
- `addSpreadToConfig(filePattern: string[], spreadExpression: string)`: Add spread operator to config object
- `removeSpreadFromConfig(filePattern: string[], spreadExpression: string)`: Remove spread operator from config object
- `hasConfigForPattern(filePattern: string[]): boolean`: Check if config exists for pattern
- `clearAllRules(filePattern: string[])`: Clear all rules for pattern
- `mergeRulesFromPattern(sourcePattern: string[], targetPattern: string[])`: Merge rules between patterns
- `copyConfigToPattern(sourcePattern: string[], targetPattern: string[])`: Copy config between patterns
- `setLanguageOptions(filePattern: string[], parser?: string | Record<string, unknown>, parserOptions?: Record<string, unknown>)`: Set language options
- `save()`: Save changes to file system
- `getContent()`: Get updated file content

### ImportTsMorphUtil

#### Constructor
- `new ImportTsMorphUtil(sourceFile: SourceFile, filePath: string)`
- `new ImportTsMorphUtil(tree: Tree, filePath: string)`

#### Methods
- `ensureImport(specifier: string, module: string, type?: ImportType)`: Ensure import exists
- `ensureFullImport(importStatement: string)`: Parse and ensure import from full statement
- `removeImport(specifier: string, module: string, type?: ImportType)`: Remove import
- `hasImport(specifier: string, module: string, type?: ImportType)`: Check if import exists
- `getImports()`: Get all imports in file
- `save()`: Save changes to file system
- `getContent()`: Get updated file content

#### Types
```typescript
type ImportType = 'named' | 'default' | 'namespace' | 'full';
```

## Best Practices

1. **Always save changes**: Call `save()` after making modifications
2. **Use type-safe imports**: Specify import types explicitly for clarity
3. **Handle errors gracefully**: Wrap operations in try-catch blocks
4. **Batch operations**: Use bulk methods like `addRules()` for better performance
5. **Validate configurations**: Check if rules/imports exist before operations
6. **Format code**: Use `formatFiles()` in Nx generators after modifications

## Building

Run `nx build nx-tools` to build the library.

## Running unit tests

Run `nx test nx-tools` to execute the unit tests via [Jest](https://jestjs.io).

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Your Organization]
