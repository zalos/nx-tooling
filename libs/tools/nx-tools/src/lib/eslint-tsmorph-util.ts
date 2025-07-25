
import { Tree } from '@nx/devkit';
import { Project, SourceFile, SyntaxKind, Node, ArrayLiteralExpression, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';

export type EslintRuleConfig = string | number | boolean | [string, ...unknown[]] | Record<string, unknown>;

export interface EslintConfigObject {
  files?: string[];
  ignores?: string[];
  rules?: Record<string, EslintRuleConfig>;
  languageOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EslintConfigOperations {
  addOrUpdateConfig(config: EslintConfigObject): void;
  removeConfig(filePattern: string[]): void;
  addRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig): void;
  removeRule(filePattern: string[], ruleName: string): void;
  updateRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig): void;
  addSpreadToRules(filePattern: string[], spreadExpression: string): void;
  removeSpreadFromRules(filePattern: string[], spreadExpression: string): void;
  addSpreadToConfig(filePattern: string[], spreadExpression: string): void;
  removeSpreadFromConfig(filePattern: string[], spreadExpression: string): void;
  getConfigs(): EslintConfigObject[];
  save(): void;
}

/**
 * Utility class for manipulating ESLint flat config files using TSMorph
 * Supports both Nx Tree and TSMorph SourceFile inputs
 */
export class EslintTsMorphUtil implements EslintConfigOperations {
  private sourceFile: SourceFile;
  private project: Project;
  private tree?: Tree;
  private filePath: string;
  private configArray?: ArrayLiteralExpression;

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
    
    this.parseConfigArray();
  }

  private isSourceFile(obj: unknown): obj is SourceFile {
    return obj && typeof obj === 'object' && obj !== null && typeof (obj as Record<string, unknown>).getProject === 'function';
  }

  /**
   * Parse the config array from the source file
   * Handles export default [...] syntax
   */
  private parseConfigArray(): void {
    // Find export default statement
    const exportAssignment = this.sourceFile.getExportAssignments()[0];
    if (!exportAssignment) {
      throw new Error('No export default found in ESLint config file');
    }

    const expression = exportAssignment.getExpression();
    if (Node.isArrayLiteralExpression(expression)) {
      this.configArray = expression;
    } else {
      throw new Error('Export default is not an array literal');
    }
  }

  /**
   * Get all configuration objects from the config array
   */
  getConfigs(): EslintConfigObject[] {
    if (!this.configArray) {
      return [];
    }

    const configs: EslintConfigObject[] = [];
    
    for (const element of this.configArray.getElements()) {
      if (Node.isObjectLiteralExpression(element)) {
        const config = this.parseConfigObject(element);
        if (config) {
          configs.push(config);
        }
      }
      // Skip spread elements for now - they represent base configs
    }

    return configs;
  }

  /**
   * Parse a single config object literal expression into EslintConfigObject
   */
  private parseConfigObject(objectExpr: ObjectLiteralExpression): EslintConfigObject | null {
    const config: EslintConfigObject = {};
    
    for (const property of objectExpr.getProperties()) {
      if (Node.isPropertyAssignment(property)) {
        const name = property.getName();
        const value = property.getInitializer();
        
        if (name === 'files' || name === 'ignores') {
          if (Node.isArrayLiteralExpression(value)) {
            config[name] = value.getElements()
              .filter(Node.isStringLiteral)
              .map(el => el.getLiteralValue());
          }
        } else if (name === 'rules') {
          if (Node.isObjectLiteralExpression(value)) {
            config.rules = this.parseRulesObject(value);
          }
        } else if (name === 'languageOptions') {
          if (Node.isObjectLiteralExpression(value)) {
            config.languageOptions = this.parseObjectLiteral(value);
          }
        } else {
          // Handle other properties
          config[name] = this.parsePropertyValue(value);
        }
      } else if (Node.isSpreadAssignment(property)) {
        // Handle spread assignments in config objects
        const spreadExpression = property.getExpression();
        const spreadText = spreadExpression.getText();
        
        // Store the spread with a special key for later reconstruction
        config[`...${spreadText}`] = undefined;
      }
    }

    return config;
  }

  /**
   * Parse rules object from ObjectLiteralExpression
   */
  private parseRulesObject(rulesObj: ObjectLiteralExpression): Record<string, EslintRuleConfig> {
    const rules: Record<string, EslintRuleConfig> = {};
    
    for (const property of rulesObj.getProperties()) {
      if (Node.isPropertyAssignment(property)) {
        const ruleName = property.getName();
        // Remove quotes from property name if present
        const cleanName = ruleName.replace(/^['"](.*)['"]$/, '$1');
        const value = property.getInitializer();
        rules[cleanName] = this.parsePropertyValue(value) as EslintRuleConfig;
      } else if (Node.isSpreadAssignment(property)) {
        // Handle spread assignments in rules
        const spreadExpression = property.getExpression();
        const spreadText = spreadExpression.getText();
        
        // Store the spread with a special key for later reconstruction
        rules[`...${spreadText}`] = null as unknown as EslintRuleConfig;
      }
    }

    return rules;
  }

  /**
   * Parse any object literal into a plain object
   */
  private parseObjectLiteral(obj: ObjectLiteralExpression): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const property of obj.getProperties()) {
      if (Node.isPropertyAssignment(property)) {
        const name = property.getName();
        // Remove quotes from property name if present
        const cleanName = name.replace(/^['"](.*)['"]$/, '$1');
        const value = property.getInitializer();
        result[cleanName] = this.parsePropertyValue(value);
      } else if (Node.isSpreadAssignment(property)) {
        // Handle spread assignments in config objects
        const spreadExpression = property.getExpression();
        const spreadText = spreadExpression.getText();
        
        // Store the spread with a special key for later reconstruction
        result[`...${spreadText}`] = undefined;
      }
    }

    return result;
  }

  /**
   * Parse property value to appropriate JavaScript type
   */
  private parsePropertyValue(value: Node | undefined): unknown {
    if (!value) return undefined;

    if (Node.isStringLiteral(value)) {
      return value.getLiteralValue();
    } else if (Node.isNumericLiteral(value)) {
      return value.getLiteralValue();
    } else if (value.getKind() === SyntaxKind.TrueKeyword) {
      return true;
    } else if (value.getKind() === SyntaxKind.FalseKeyword) {
      return false;
    } else if (value.getKind() === SyntaxKind.NullKeyword) {
      return null;
    } else if (value.getKind() === SyntaxKind.UndefinedKeyword) {
      return undefined;
    } else if (Node.isIdentifier(value) && value.getText() === 'undefined') {
      return undefined;
    } else if (Node.isArrayLiteralExpression(value)) {
      return value.getElements().map(el => this.parsePropertyValue(el));
    } else if (Node.isObjectLiteralExpression(value)) {
      return this.parseObjectLiteral(value);
    } else if (Node.isAwaitExpression(value) && Node.isCallExpression(value.getExpression())) {
      // Handle await import(...) syntax
      const callExpr = value.getExpression();
      if (Node.isCallExpression(callExpr)) {
        const expr = callExpr.getExpression();
        // Check for dynamic import expression
        if (Node.isImportExpression(expr)) {
          const args = callExpr.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            return { __dynamicImport: args[0].getLiteralValue() };
          }
        }
        // Check for traditional import() call
        else if (Node.isIdentifier(expr) && expr.getText() === 'import') {
          const args = callExpr.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            return { __dynamicImport: args[0].getLiteralValue() };
          }
        }
      }
    }

    // For complex expressions, return the text representation
    return value.getText();
  }

  /**
   * Find existing config object that matches the given file patterns
   */
  private findConfigByFiles(files: string[]): ObjectLiteralExpression | null {
    if (!this.configArray) return null;

    for (const element of this.configArray.getElements()) {
      if (Node.isObjectLiteralExpression(element)) {
        const filesProperty = element.getProperty('files');
        if (Node.isPropertyAssignment(filesProperty)) {
          const filesValue = filesProperty.getInitializer();
          if (Node.isArrayLiteralExpression(filesValue)) {
            const existingFiles = filesValue.getElements()
              .filter(Node.isStringLiteral)
              .map(el => el.getLiteralValue());
            
            // Check if arrays are equal
            if (this.arraysEqual(existingFiles, files)) {
              return element;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if two arrays are equal (order-independent for file patterns)
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    
    // For file patterns, order shouldn't matter
    // Sort both arrays and compare
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    
    return sortedA.every((val, index) => val === sortedB[index]);
  }

  /**
   * Add or update a configuration object
   * If a config with the same files pattern exists, it will be updated
   * Otherwise, a new config will be added
   */
  addOrUpdateConfig(config: EslintConfigObject): void {
    if (!this.configArray) {
      throw new Error('Config array not found');
    }

    const files = config.files || [];
    const existingConfig = this.findConfigByFiles(files);

    if (existingConfig) {
      // Update existing config
      this.updateConfigObject(existingConfig, config);
    } else {
      // Add new config
      this.addNewConfigObject(config);
    }
  }

  /**
   * Update an existing config object literal expression
   */
  private updateConfigObject(configObj: ObjectLiteralExpression, newConfig: EslintConfigObject): void {
    // Update or add each property
    for (const [key, value] of Object.entries(newConfig)) {
      const existingProperty = configObj.getProperty(key);
      
      if (existingProperty && Node.isPropertyAssignment(existingProperty)) {
        // Update existing property
        if (key === 'rules' && typeof value === 'object' && value !== null) {
          this.updateRulesProperty(existingProperty, value as Record<string, EslintRuleConfig>);
        } else {
          existingProperty.setInitializer(this.valueToString(value));
        }
      } else {
        // Add new property
        configObj.addPropertyAssignment({
          name: key,
          initializer: this.valueToString(value)
        });
      }
    }
  }

  /**
   * Update rules property by merging with existing rules
   */
  private updateRulesProperty(rulesProperty: PropertyAssignment, newRules: Record<string, EslintRuleConfig>): void {
    const rulesObj = rulesProperty.getInitializer();
    if (!Node.isObjectLiteralExpression(rulesObj)) {
      rulesProperty.setInitializer(this.valueToString(newRules));
      return;
    }

    // Update existing rules and add new ones
    for (const [ruleName, ruleConfig] of Object.entries(newRules)) {
      const existingRule = rulesObj.getProperty(ruleName);
      
      if (existingRule && Node.isPropertyAssignment(existingRule)) {
        existingRule.setInitializer(this.valueToString(ruleConfig));
      } else {
        rulesObj.addPropertyAssignment({
          name: `'${ruleName}'`,
          initializer: this.valueToString(ruleConfig)
        });
      }
    }
  }

  /**
   * Add a new config object to the array
   */
  private addNewConfigObject(config: EslintConfigObject): void {
    if (!this.configArray) return;

    const properties = Object.entries(config).map(([key, value]) => ({
      name: key,
      initializer: this.valueToString(value)
    }));

    this.configArray.addElement(`{
${properties.map(p => `  ${p.name}: ${p.initializer}`).join(',\n')}
}`);
  }

  /**
   * Convert a JavaScript value to its string representation for TSMorph
   */
  private valueToString(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      const elements = value.map(v => this.valueToString(v)).join(', ');
      return `[${elements}]`;
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.__dynamicImport) {
        return `await import('${obj.__dynamicImport}')`;
      }
      
      const properties = [];
      for (const [k, v] of Object.entries(obj)) {
        // Handle spread operators - keys starting with '...'
        if (k.startsWith('...')) {
          const spreadExpression = k.substring(3); // Remove the '...' prefix
          properties.push(`...${spreadExpression}`);
        } else {
          properties.push(`'${k}': ${this.valueToString(v)}`);
        }
      }
      
      return `{ ${properties.join(', ')} }`;
    }
    return String(value);
  }

  /**
   * Remove a config object by file patterns
   */
  removeConfig(filePattern: string[]): void {
    if (!this.configArray) return;

    const elements = this.configArray.getElements();
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (Node.isObjectLiteralExpression(element)) {
        const filesProperty = element.getProperty('files');
        if (Node.isPropertyAssignment(filesProperty)) {
          const filesValue = filesProperty.getInitializer();
          if (Node.isArrayLiteralExpression(filesValue)) {
            const existingFiles = filesValue.getElements()
              .filter(Node.isStringLiteral)
              .map(el => el.getLiteralValue());
            
            // Check if arrays are equal
            if (this.arraysEqual(existingFiles, filePattern)) {
              this.configArray.removeElement(i);
              return;
            }
          }
        }
      }
    }
  }

  /**
   * Add a rule to configs matching the file pattern
   */
  addRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig): void {
    const configObj = this.findConfigByFiles(filePattern);
    if (!configObj) {
      // Create new config with the rule
      this.addOrUpdateConfig({
        files: filePattern,
        rules: { [ruleName]: ruleConfig }
      });
      return;
    }

    // Add rule to existing config
    const rulesProperty = configObj.getProperty('rules');
    if (Node.isPropertyAssignment(rulesProperty)) {
      const rulesObj = rulesProperty.getInitializer();
      if (Node.isObjectLiteralExpression(rulesObj)) {
        rulesObj.addPropertyAssignment({
          name: `'${ruleName}'`,
          initializer: this.valueToString(ruleConfig)
        });
      }
    } else {
      // Add rules property
      configObj.addPropertyAssignment({
        name: 'rules',
        initializer: `{ '${ruleName}': ${this.valueToString(ruleConfig)} }`
      });
    }
  }

  /**
   * Remove a rule from configs matching the file pattern
   */
  removeRule(filePattern: string[], ruleName: string): void {
    const configObj = this.findConfigByFiles(filePattern);
    if (!configObj) return;

    const rulesProperty = configObj.getProperty('rules');
    if (Node.isPropertyAssignment(rulesProperty)) {
      const rulesObj = rulesProperty.getInitializer();
      if (Node.isObjectLiteralExpression(rulesObj)) {
        const ruleProperty = rulesObj.getProperty(ruleName) || rulesObj.getProperty(`'${ruleName}'`) || rulesObj.getProperty(`"${ruleName}"`);
        if (ruleProperty) {
          ruleProperty.remove();
        }
      }
    }
  }

  /**
   * Update a rule in configs matching the file pattern
   */
  updateRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig): void {
    const configObj = this.findConfigByFiles(filePattern);
    if (!configObj) {
      this.addRule(filePattern, ruleName, ruleConfig);
      return;
    }

    const rulesProperty = configObj.getProperty('rules');
    if (Node.isPropertyAssignment(rulesProperty)) {
      const rulesObj = rulesProperty.getInitializer();
      if (Node.isObjectLiteralExpression(rulesObj)) {
        const ruleProperty = rulesObj.getProperty(ruleName) || rulesObj.getProperty(`'${ruleName}'`) || rulesObj.getProperty(`"${ruleName}"`);
        if (Node.isPropertyAssignment(ruleProperty)) {
          ruleProperty.setInitializer(this.valueToString(ruleConfig));
        } else {
          rulesObj.addPropertyAssignment({
            name: `'${ruleName}'`,
            initializer: this.valueToString(ruleConfig)
          });
        }
      }
    }
  }

  /**
   * Save changes back to the file
   * For Tree, updates the tree. For SourceFile, saves to disk
   */
  save(): void {
    const content = this.sourceFile.getFullText();
    
    if (this.tree) {
      this.tree.write(this.filePath, content);
    } else {
      this.sourceFile.saveSync();
    }
  }

  /**
   * Get the current file content as string
   */
  getContent(): string {
    return this.sourceFile.getFullText();
  }

  // ============================================================================
  // USABILITY HELPER METHODS
  // ============================================================================

  /**
   * Ensure a rule exists with the specified configuration
   * If the rule already exists, it will be updated with the new configuration
   * If the file pattern doesn't exist, a new config will be created
   */
  ensureRule(filePattern: string[], ruleName: string, ruleConfig: EslintRuleConfig): void {
    this.updateRule(filePattern, ruleName, ruleConfig);
  }

  /**
   * Remove a rule if it exists - does nothing if rule or config doesn't exist
   * Safe to call on non-existent rules
   */
  removeRuleIfExists(filePattern: string[], ruleName: string): void {
    this.removeRule(filePattern, ruleName);
  }

  /**
   * Add multiple rules to a file pattern at once
   */
  addMultipleRules(filePattern: string[], rules: Record<string, EslintRuleConfig>): void {
    Object.entries(rules).forEach(([ruleName, ruleConfig]) => {
      this.addRule(filePattern, ruleName, ruleConfig);
    });
  }

  /**
   * Remove multiple rules from a file pattern at once
   */
  removeMultipleRules(filePattern: string[], ruleNames: string[]): void {
    ruleNames.forEach(ruleName => {
      this.removeRule(filePattern, ruleName);
    });
  }

  /**
   * Get all rules for a specific file pattern
   */
  getRulesForPattern(filePattern: string[]): Record<string, EslintRuleConfig> | undefined {
    const config = this.findConfigByFiles(filePattern);
    if (!config) return undefined;

    const rulesProperty = config.getProperty('rules');
    if (!Node.isPropertyAssignment(rulesProperty)) return undefined;

    const rulesObject = rulesProperty.getInitializer();
    if (!Node.isObjectLiteralExpression(rulesObject)) return undefined;

    return this.parseRulesObject(rulesObject);
  }

  /**
   * Check if a rule exists for a file pattern
   */
  hasRule(filePattern: string[], ruleName: string): boolean {
    const rules = this.getRulesForPattern(filePattern);
    return rules ? ruleName in rules : false;
  }

  /**
   * Get a specific rule configuration for a file pattern
   */
  getRule(filePattern: string[], ruleName: string): EslintRuleConfig | undefined {
    const rules = this.getRulesForPattern(filePattern);
    return rules?.[ruleName];
  }

  // ============================================================================
  // COMMON ESLint CONFIGURATION PRESETS
  // ============================================================================

  /**
   * Add common TypeScript rules for a project
   */
  addTypeScriptRules(filePattern: string[] = ['**/*.ts', '**/*.tsx']): void {
    this.ensureRule(filePattern, '@typescript-eslint/no-unused-vars', 'error');
    this.ensureRule(filePattern, '@typescript-eslint/explicit-function-return-type', 'off');
    this.ensureRule(filePattern, '@typescript-eslint/explicit-module-boundary-types', 'off');
    this.ensureRule(filePattern, '@typescript-eslint/no-explicit-any', 'warn');
  }

  /**
   * Add common React rules for a project
   */
  addReactRules(filePattern: string[] = ['**/*.tsx', '**/*.jsx']): void {
    this.ensureRule(filePattern, 'react/prop-types', 'off');
    this.ensureRule(filePattern, 'react/react-in-jsx-scope', 'off');
    this.ensureRule(filePattern, 'react-hooks/rules-of-hooks', 'error');
    this.ensureRule(filePattern, 'react-hooks/exhaustive-deps', 'warn');
  }

  /**
   * Add Angular-specific rules
   */
  addAngularRules(filePattern: string[] = ['**/*.ts'], componentPrefix = 'app'): void {
    this.ensureRule(filePattern, '@angular-eslint/component-selector', [
      'error',
      {
        type: 'element',
        prefix: componentPrefix,
        style: 'kebab-case'
      }
    ]);
    this.ensureRule(filePattern, '@angular-eslint/directive-selector', [
      'error',
      {
        type: 'attribute',
        prefix: componentPrefix,
        style: 'camelCase'
      }
    ]);
  }

  /**
   * Add Playwright test rules for E2E testing
   */
  addPlaywrightRules(filePattern: string[] = ['**/*.e2e.ts', 'e2e/**/*.ts']): void {
    this.ensureRule(filePattern, 'playwright/expect-expect', 'error');
    this.ensureRule(filePattern, 'playwright/no-wait-for-timeout', 'warn');
    this.ensureRule(filePattern, 'playwright/no-force-option', 'error');
    this.ensureRule(filePattern, 'playwright/prefer-web-first-assertions', 'error');
  }

  /**
   * Add Jest test rules
   */
  addJestRules(filePattern: string[] = ['**/*.spec.ts', '**/*.test.ts']): void {
    this.ensureRule(filePattern, 'jest/expect-expect', 'error');
    this.ensureRule(filePattern, 'jest/no-disabled-tests', 'warn');
    this.ensureRule(filePattern, 'jest/no-focused-tests', 'error');
    this.ensureRule(filePattern, 'jest/valid-expect', 'error');
  }

  /**
   * Add Nx-specific workspace rules
   */
  addNxWorkspaceRules(filePattern: string[] = ['**/*.ts', '**/*.js']): void {
    this.ensureRule(filePattern, '@nx/enforce-module-boundaries', [
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
  addNxDependencyChecks(filePattern: string[] = ['**/*.ts', '**/*.js'], ignoredFiles: string[] = []): void {
    const defaultIgnoredFiles = ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'];
    const allIgnoredFiles = [...defaultIgnoredFiles, ...ignoredFiles];

    this.ensureRule(filePattern, '@nx/dependency-checks', [
      'error',
      {
        ignoredFiles: allIgnoredFiles
      }
    ]);
  }

  // ============================================================================
  // BULK OPERATIONS FOR MIGRATIONS
  // ============================================================================

  /**
   * Remove deprecated rules that are commonly removed during ESLint upgrades
   */
  removeDeprecatedRules(filePattern: string[]): void {
    const deprecatedRules = [
      'babel/new-cap',
      'babel/no-invalid-this',
      'babel/object-curly-spacing',
      'babel/quotes',
      'babel/semi',
      'babel/no-unused-expressions',
      'babel/valid-typeof',
      '@typescript-eslint/ban-ts-ignore',
      '@typescript-eslint/camelcase',
      '@typescript-eslint/no-angle-bracket-type-assertion'
    ];

    this.removeMultipleRules(filePattern, deprecatedRules);
  }

  /**
   * Update rules that have been renamed
   */
  updateRenamedRules(filePattern: string[]): void {
    const renamedRules = [
      { old: '@typescript-eslint/ban-ts-ignore', new: '@typescript-eslint/ban-ts-comment' },
      { old: '@typescript-eslint/camelcase', new: '@typescript-eslint/naming-convention' },
      { old: 'no-spaced-func', new: 'func-call-spacing' }
    ];

    renamedRules.forEach(({ old, new: newRule }) => {
      const currentConfig = this.getRule(filePattern, old);
      if (currentConfig !== undefined) {
        this.removeRule(filePattern, old);
        this.ensureRule(filePattern, newRule, currentConfig);
      }
    });
  }

  /**
   * Remove all rules from a configuration (keeps the config but clears rules)
   */
  clearAllRules(filePattern: string[]): void {
    const config = this.findConfigByFiles(filePattern);
    if (!config) return;

    const rulesProperty = config.getProperty('rules');
    if (Node.isPropertyAssignment(rulesProperty)) {
      rulesProperty.remove();
    }
  }

  /**
   * Check if any configuration exists for a file pattern
   */
  hasConfigForPattern(filePattern: string[]): boolean {
    return this.findConfigByFiles(filePattern) !== null;
  }

  /**
   * Get all file patterns that have configurations
   */
  getAllConfiguredPatterns(): string[][] {
    return this.getConfigs()
      .map(config => config.files)
      .filter((files): files is string[] => Array.isArray(files));
  }

  /**
   * Merge rules from one pattern into another
   */
  mergeRulesFromPattern(sourcePattern: string[], targetPattern: string[]): void {
    const sourceRules = this.getRulesForPattern(sourcePattern);
    if (sourceRules) {
      this.addMultipleRules(targetPattern, sourceRules);
    }
  }

  /**
   * Copy entire configuration from one pattern to another
   */
  copyConfigToPattern(sourcePattern: string[], targetPattern: string[]): void {
    const configs = this.getConfigs();
    const sourceConfig = configs.find(config => 
      config.files && this.arraysEqual(config.files, sourcePattern)
    );

    if (sourceConfig) {
      const newConfig = { ...sourceConfig, files: targetPattern };
      this.addOrUpdateConfig(newConfig);
    }
  }

  /**
   * Set parser and parser options for a configuration
   */
  setLanguageOptions(filePattern: string[], parser?: string | Record<string, unknown>, parserOptions?: Record<string, unknown>): void {
    const config = this.findConfigByFiles(filePattern);
    if (!config) {
      // Create new config with language options
      this.addOrUpdateConfig({
        files: filePattern,
        languageOptions: {
          ...(parser && { parser }),
          ...(parserOptions && { parserOptions })
        }
      });
      return;
    }

    // Update existing config
    const languageOptionsProperty = config.getProperty('languageOptions');
    
    if (!languageOptionsProperty) {
      // Add languageOptions property
      config.addPropertyAssignment({
        name: 'languageOptions',
        initializer: `{
          ${parser ? `parser: ${typeof parser === 'string' ? `'${parser}'` : JSON.stringify(parser)},` : ''}
          ${parserOptions ? `parserOptions: ${JSON.stringify(parserOptions)}` : ''}
        }`
      });
    } else if (Node.isPropertyAssignment(languageOptionsProperty)) {
      // Update existing languageOptions
      const initializer = languageOptionsProperty.getInitializer();
      if (Node.isObjectLiteralExpression(initializer)) {
        if (parser) {
          const parserProp = initializer.getProperty('parser');
          if (parserProp && Node.isPropertyAssignment(parserProp)) {
            parserProp.setInitializer(typeof parser === 'string' ? `'${parser}'` : JSON.stringify(parser));
          } else {
            initializer.addPropertyAssignment({
              name: 'parser',
              initializer: typeof parser === 'string' ? `'${parser}'` : JSON.stringify(parser)
            });
          }
        }

        if (parserOptions) {
          const parserOptionsProp = initializer.getProperty('parserOptions');
          if (parserOptionsProp && Node.isPropertyAssignment(parserOptionsProp)) {
            parserOptionsProp.setInitializer(JSON.stringify(parserOptions));
          } else {
            initializer.addPropertyAssignment({
              name: 'parserOptions',
              initializer: JSON.stringify(parserOptions)
            });
          }
        }
      }
    }
  }

  /**
   * Add a spread operator to the rules section of a config
   */
  addSpreadToRules(filePattern: string[], spreadExpression: string): void {
    const config = this.findConfigByFiles(filePattern);
    if (!config) {
      throw new Error(`No config found for files: ${filePattern.join(', ')}`);
    }

    const rulesProperty = config.getProperty('rules');
    if (!rulesProperty || !Node.isPropertyAssignment(rulesProperty)) {
      throw new Error('Rules property must be an object literal');
    }

    const rulesObj = rulesProperty.getInitializer();
    if (!Node.isObjectLiteralExpression(rulesObj)) {
      throw new Error('Rules property must be an object literal');
    }
    
    // Add spread assignment
    rulesObj.addSpreadAssignment({ expression: spreadExpression });
  }

  /**
   * Remove a spread operator from the rules section of a config
   */
  removeSpreadFromRules(filePattern: string[], spreadExpression: string): void {
    const config = this.findConfigByFiles(filePattern);
    if (!config) {
      throw new Error(`No config found for files: ${filePattern.join(', ')}`);
    }

    const rulesProperty = config.getProperty('rules');
    if (!rulesProperty || !Node.isPropertyAssignment(rulesProperty)) {
      throw new Error('Rules property must be an object literal');
    }

    const rulesObj = rulesProperty.getInitializer();
    if (!Node.isObjectLiteralExpression(rulesObj)) {
      throw new Error('Rules property must be an object literal');
    }
    
    // Find and remove matching spread assignments
    for (const property of rulesObj.getProperties()) {
      if (Node.isSpreadAssignment(property)) {
        const expr = property.getExpression().getText();
        if (expr === spreadExpression) {
          property.remove();
          break;
        }
      }
    }
  }

  /**
   * Add a spread operator to the config object (at the top level)
   */
  addSpreadToConfig(filePattern: string[], spreadExpression: string): void {
    const config = this.findConfigByFiles(filePattern);
    if (!config) {
      throw new Error(`No config found for files: ${filePattern.join(', ')}`);
    }

    // Add spread assignment to the config object
    config.addSpreadAssignment({ expression: spreadExpression });
  }

  /**
   * Remove a spread operator from the config object (at the top level)
   */
  removeSpreadFromConfig(filePattern: string[], spreadExpression: string): void {
    const config = this.findConfigByFiles(filePattern);
    if (!config) {
      throw new Error(`No config found for files: ${filePattern.join(', ')}`);
    }

    // Find and remove matching spread assignments
    for (const property of config.getProperties()) {
      if (Node.isSpreadAssignment(property)) {
        const expr = property.getExpression().getText();
        if (expr === spreadExpression) {
          property.remove();
          break;
        }
      }
    }
  }
}