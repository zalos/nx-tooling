# Framework-Specific ESLint Configuration Examples

The following examples show how to use the `EslintTsMorphUtil` to configure ESLint for different frameworks. These are standalone examples that you can adapt for your specific needs.

## TypeScript Configuration

```typescript
/**
 * Add common TypeScript rules for a project
 */
function addTypeScriptRules(eslintUtil: EslintTsMorphUtil, filePattern: string[] = ['**/*.ts', '**/*.tsx']): void {
  eslintUtil.addRule(filePattern, '@typescript-eslint/no-unused-vars', 'error');
  eslintUtil.addRule(filePattern, '@typescript-eslint/explicit-function-return-type', 'off');
  eslintUtil.addRule(filePattern, '@typescript-eslint/explicit-module-boundary-types', 'off');
  eslintUtil.addRule(filePattern, '@typescript-eslint/no-explicit-any', 'warn');
}
```

## React Configuration

```typescript
/**
 * Add common React rules for a project
 */
function addReactRules(eslintUtil: EslintTsMorphUtil, filePattern: string[] = ['**/*.tsx', '**/*.jsx']): void {
  eslintUtil.addRule(filePattern, 'react/prop-types', 'off');
  eslintUtil.addRule(filePattern, 'react/react-in-jsx-scope', 'off');
  eslintUtil.addRule(filePattern, 'react-hooks/rules-of-hooks', 'error');
  eslintUtil.addRule(filePattern, 'react-hooks/exhaustive-deps', 'warn');
}
```

## Angular Configuration

```typescript
/**
 * Add Angular-specific rules
 */
function addAngularRules(eslintUtil: EslintTsMorphUtil, filePattern: string[] = ['**/*.ts'], componentPrefix = 'app'): void {
  eslintUtil.addRule(filePattern, '@angular-eslint/component-selector', [
    'error',
    {
      type: 'element',
      prefix: componentPrefix,
      style: 'kebab-case'
    }
  ]);
  eslintUtil.addRule(filePattern, '@angular-eslint/directive-selector', [
    'error',
    {
      type: 'attribute',
      prefix: componentPrefix,
      style: 'camelCase'
    }
  ]);
}
```

## Playwright Configuration

```typescript
/**
 * Add Playwright test rules for E2E testing
 */
function addPlaywrightRules(eslintUtil: EslintTsMorphUtil, filePattern: string[] = ['**/*.e2e.ts', 'e2e/**/*.ts']): void {
  eslintUtil.addRule(filePattern, 'playwright/expect-expect', 'error');
  eslintUtil.addRule(filePattern, 'playwright/no-wait-for-timeout', 'warn');
  eslintUtil.addRule(filePattern, 'playwright/no-force-option', 'error');
  eslintUtil.addRule(filePattern, 'playwright/prefer-web-first-assertions', 'error');
}
```

## Jest Configuration

```typescript
/**
 * Add Jest test rules
 */
function addJestRules(eslintUtil: EslintTsMorphUtil, filePattern: string[] = ['**/*.spec.ts', '**/*.test.ts']): void {
  eslintUtil.addRule(filePattern, 'jest/expect-expect', 'error');
  eslintUtil.addRule(filePattern, 'jest/no-disabled-tests', 'warn');
  eslintUtil.addRule(filePattern, 'jest/no-focused-tests', 'error');
  eslintUtil.addRule(filePattern, 'jest/valid-expect', 'error');
}
```

## Nx Workspace Configuration

```typescript
/**
 * Add Nx-specific workspace rules
 */
function addNxWorkspaceRules(eslintUtil: EslintTsMorphUtil, filePattern: string[] = ['**/*.ts', '**/*.js']): void {
  eslintUtil.addRule(filePattern, '@nx/enforce-module-boundaries', [
    'error',
    {
      enforceBuildableLibDependency: true,
      allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
      depConstraints: [
        {
          sourceTag: '*',
          onlyDependOnLibsWithTags: ['*'],
        },
      ],
    }
  ]);
}

/**
 * Add dependency checks for a specific project
 */
function addNxDependencyChecks(eslintUtil: EslintTsMorphUtil, filePattern: string[] = ['**/*.ts', '**/*.js'], ignoredFiles: string[] = []): void {
  const defaultIgnoredFiles = ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'];
  const allIgnoredFiles = [...defaultIgnoredFiles, ...ignoredFiles];

  eslintUtil.addRule(filePattern, '@nx/dependency-checks', [
    'error',
    {
      ignoredFiles: allIgnoredFiles
    }
  ]);
}
```

## Usage Examples

### Setting up a React TypeScript project

```typescript
const eslintUtil = new EslintTsMorphUtil(tree, 'eslint.config.mjs');

// Add TypeScript configuration
addTypeScriptRules(eslintUtil, ['**/*.ts', '**/*.tsx']);

// Add React configuration  
addReactRules(eslintUtil, ['**/*.tsx']);

// Add Jest for tests
addJestRules(eslintUtil, ['**/*.spec.ts', '**/*.spec.tsx']);

eslintUtil.save();
```

### Setting up an Angular project

```typescript
const eslintUtil = new EslintTsMorphUtil(tree, 'eslint.config.mjs');

// Add TypeScript configuration
addTypeScriptRules(eslintUtil, ['**/*.ts']);

// Add Angular configuration with custom prefix
addAngularRules(eslintUtil, ['**/*.ts'], 'myapp');

// Add Playwright for E2E tests
addPlaywrightRules(eslintUtil, ['e2e/**/*.ts']);

eslintUtil.save();
```
