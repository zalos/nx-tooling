
import { Tree } from '@nx/devkit';
import { Project, SourceFile, SyntaxKind, Node, ArrayLiteralExpression, ObjectLiteralExpression, PropertyAssignment, CallExpression } from 'ts-morph';

/** 
 * ESLint rule configuration value types.
 * Can be a simple string/number/boolean, an array with severity and options, or a complex object.
 */
export type EslintRuleConfig = string | number | boolean | [string, ...unknown[]] | Record<string, unknown>;

/**
 * ESLint flat configuration object structure.
 * Represents a single configuration entry in the ESLint flat config array.
 */
export interface EslintConfigObject {
  /** File patterns this configuration applies to */
  files?: string[];
  /** File patterns this configuration ignores */
  ignores?: string[];
  /** ESLint rules for this configuration */
  rules?: Record<string, EslintRuleConfig>;
  /** Language-specific options (parser, parserOptions, etc.) */
  languageOptions?: Record<string, unknown>;
  /** Additional configuration properties (plugins, extends, etc.) */
  [key: string]: unknown;
}

/**
 * Core operations interface for ESLint configuration management.
 * Defines the essential methods for manipulating ESLint flat configurations.
 */
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
 * Advanced utility class for programmatically manipulating ESLint flat configuration files using TSMorph AST manipulation.
 * 
 * This class provides comprehensive support for:
 * - Reading and parsing existing ESLint flat configurations
 * - Adding, updating, and removing configuration objects
 * - Managing individual rules within configurations  
 * - Handling spread operators at both config and rules levels
 * - Bulk operations and preset configurations
 * - Integration with Nx workspace file operations
 * 
 * @example
 * ```typescript
 * // Initialize with Nx Tree for workspace integration
 * const eslintUtil = new EslintTsMorphUtil(tree, 'eslint.config.mjs');
 * 
 * // Add Playwright configuration with spread operators
 * eslintUtil.addOrUpdateConfig({
 *   '...playwright.configs[\'flat/recommended\']': true,
 *   files: ['tests/**'],
 *   rules: {
 *     '...playwright.configs[\'flat/recommended\'].rules': true,
 *     'playwright/expect-expect': 'error'
 *   }
 * });
 * 
 * eslintUtil.save();
 * ```
 * 
 * @example  
 * ```typescript
 * // Initialize with TSMorph SourceFile for direct manipulation
 * const eslintUtil = new EslintTsMorphUtil(sourceFile, 'eslint.config.ts');
 * 
 * // Add custom rule
 * eslintUtil.addRule(['**\/*.ts'], '@typescript-eslint/no-unused-vars', 'error');
 * 
 * // Add multiple rules via configuration object
 * eslintUtil.addOrUpdateConfig({
 *   files: ['**\/*.ts', '**\/*.tsx'],
 *   rules: {
 *     '@typescript-eslint/explicit-function-return-type': 'off',
 *     '@typescript-eslint/no-explicit-any': 'warn'
 *   }
 * });
 * ```
 */
export class EslintTsMorphUtil implements EslintConfigOperations {
  private readonly sourceFile: SourceFile;
  private readonly project: Project;
  private readonly tree?: Tree;
  private readonly filePath: string;
  private configArray?: ArrayLiteralExpression;

  /**
   * Creates a new EslintTsMorphUtil instance from a TSMorph SourceFile.
   * The file path will be automatically detected from the SourceFile.
   * 
   * @param sourceFile - TSMorph SourceFile for direct AST manipulation
   */
  constructor(sourceFile: SourceFile);
  
  /**
   * Creates a new EslintTsMorphUtil instance from a TSMorph SourceFile with custom path.
   * 
   * @param sourceFile - TSMorph SourceFile for direct AST manipulation
   * @param filePath - Path to the ESLint configuration file
   */
  constructor(sourceFile: SourceFile, filePath: string);
  
  /**
   * Creates a new EslintTsMorphUtil instance from an Nx Tree.
   * 
   * @param tree - Nx Tree for workspace file operations
   * @param filePath - Path to the ESLint configuration file
   */
  constructor(tree: Tree, filePath: string);
  
  constructor(sourceFileOrTree: SourceFile | Tree, filePath?: string) {
    if (this.isSourceFile(sourceFileOrTree)) {
      this.sourceFile = sourceFileOrTree;
      this.project = sourceFileOrTree.getProject();
      // Use provided filePath or get it from the SourceFile
      this.filePath = filePath || sourceFileOrTree.getFilePath();
    } else {
      if (!filePath) {
        throw new Error('filePath is required when using Tree constructor');
      }
      this.tree = sourceFileOrTree;
      this.filePath = filePath;
      this.project = new Project();
      
      // Read file content from tree
      const fileContent = this.tree.read(this.filePath)?.toString() || '';
      this.sourceFile = this.project.createSourceFile(this.filePath, fileContent, { overwrite: true });
    }
    
    this.parseConfigArray();
  }

  /**
   * Type guard to determine if the input is a TSMorph SourceFile.
   * 
   * @param input - The input object to check
   * @returns True if input is a SourceFile, false otherwise
   */
  private isSourceFile(input: unknown): input is SourceFile {
    return input && typeof input === 'object' && input !== null && 
           typeof (input as Record<string, unknown>).getProject === 'function';
  }

  /**
   * Parses the main configuration array from the ESLint config file.
   * Looks for and validates the "export default [...]" statement.
   * 
   * @throws {Error} When no export default is found or it's not an array literal
   * @private
   */
  private parseConfigArray(): void {
    // Find the export default statement
    const exportAssignment = this.sourceFile.getExportAssignments()[0];
    if (!exportAssignment) {
      throw new Error(`No export default found in ESLint config file: ${this.filePath}`);
    }

    const defaultExpression = exportAssignment.getExpression();
    if (Node.isArrayLiteralExpression(defaultExpression)) {
      this.configArray = defaultExpression;
    } else {
      throw new Error(`Export default must be an array literal in ESLint flat config: ${this.filePath}`);
    }
  }

  /**
   * Retrieves all configuration objects from the ESLint config array.
   * Filters out spread elements and only returns parsed object literals.
   * 
   * @returns Array of parsed ESLint configuration objects
   */
  getConfigs(): EslintConfigObject[] {
    if (!this.configArray) {
      return [];
    }

    const configs: EslintConfigObject[] = [];
    
    for (const element of this.configArray.getElements()) {
      if (!Node.isObjectLiteralExpression(element)) {
        // Skip spread elements and other non-object expressions
        continue;
      }
      
      const parsedConfig = this.parseConfigObject(element);
      if (parsedConfig) {
        configs.push(parsedConfig);
      }
    }

    return configs;
  }

  /**
   * Parses a single ObjectLiteralExpression into an EslintConfigObject.
   * Handles all standard ESLint config properties including spread operators.
   * 
   * @param objectExpression - The TSMorph ObjectLiteralExpression to parse
   * @returns Parsed config object or null if parsing fails
   * @private
   */
  private parseConfigObject(objectExpression: ObjectLiteralExpression): EslintConfigObject | null {
    const configObject: EslintConfigObject = {};
    
    for (const property of objectExpression.getProperties()) {
      if (Node.isPropertyAssignment(property)) {
        const propertyName = property.getName();
        const propertyValue = property.getInitializer();
        
        if (propertyName === 'files' || propertyName === 'ignores') {
          configObject[propertyName] = this.parseStringArrayProperty(propertyValue);
        } else if (propertyName === 'rules') {
          configObject.rules = this.parseRulesProperty(propertyValue);
        } else if (propertyName === 'languageOptions') {
          configObject.languageOptions = this.parseObjectProperty(propertyValue);
        } else {
          // Handle other properties generically
          configObject[propertyName] = this.parsePropertyValue(propertyValue);
        }
      } else if (Node.isSpreadAssignment(property)) {
        // Handle spread assignments in config objects
        const spreadExpression = property.getExpression();
        const spreadKey = `...${spreadExpression.getText()}`;
        
        // Store the spread with a special key for later reconstruction
        configObject[spreadKey] = undefined;
      }
    }

    return configObject;
  }

  /**
   * Parses a string array property (files, ignores).
   * 
   * @param propertyValue - The property value to parse
   * @returns Array of strings or undefined
   * @private
   */
  private parseStringArrayProperty(propertyValue: Node | undefined): string[] | undefined {
    if (Node.isArrayLiteralExpression(propertyValue)) {
      return propertyValue.getElements()
        .filter(Node.isStringLiteral)
        .map(element => element.getLiteralValue());
    }
    return undefined;
  }

  /**
   * Parses a rules property value.
   * 
   * @param propertyValue - The rules property value to parse
   * @returns Parsed rules object or undefined
   * @private
   */
  private parseRulesProperty(propertyValue: Node | undefined): Record<string, EslintRuleConfig> | undefined {
    if (Node.isObjectLiteralExpression(propertyValue)) {
      return this.parseRulesObject(propertyValue);
    }
    return undefined;
  }

  /**
   * Parses a generic object property.
   * 
   * @param propertyValue - The object property value to parse
   * @returns Parsed object or undefined
   * @private
   */
  private parseObjectProperty(propertyValue: Node | undefined): Record<string, unknown> | undefined {
    if (Node.isObjectLiteralExpression(propertyValue)) {
      return this.parseObjectLiteral(propertyValue);
    }
    return undefined;
  }

  /**
   * Parses an ESLint rules object from ObjectLiteralExpression.
   * Handles both regular rule properties and spread assignments.
   * 
   * @param rulesObjectExpression - The rules object to parse
   * @returns Parsed rules configuration
   * @private
   */
  private parseRulesObject(rulesObjectExpression: ObjectLiteralExpression): Record<string, EslintRuleConfig> {
    const rulesConfig: Record<string, EslintRuleConfig> = {};
    
    for (const property of rulesObjectExpression.getProperties()) {
      if (Node.isPropertyAssignment(property)) {
        const ruleName = property.getName();
        // Remove quotes from property name if present
        const cleanRuleName = ruleName.replace(/^(['"])(.*)\1$/, '$2');
        const ruleValue = property.getInitializer();
        rulesConfig[cleanRuleName] = this.parsePropertyValue(ruleValue) as EslintRuleConfig;
      } else if (Node.isSpreadAssignment(property)) {
        // Handle spread assignments in rules
        const spreadExpression = property.getExpression();
        const spreadKey = `...${spreadExpression.getText()}`;
        
        // Store the spread with a special key for later reconstruction
        rulesConfig[spreadKey] = null as unknown as EslintRuleConfig;
      }
    }

    return rulesConfig;
  }

  /**
   * Parses any ObjectLiteralExpression into a plain JavaScript object.
   * Handles property assignments and spread operators.
   * 
   * @param objectExpression - The object literal to parse
   * @returns Parsed plain object
   * @private
   */
  private parseObjectLiteral(objectExpression: ObjectLiteralExpression): Record<string, unknown> {
    const resultObject: Record<string, unknown> = {};
    
    for (const property of objectExpression.getProperties()) {
      if (Node.isPropertyAssignment(property)) {
        const propertyName = property.getName();
        // Remove quotes from property name if present  
        const cleanPropertyName = propertyName.replace(/^(['"])(.*)\1$/, '$2');
        const propertyValue = property.getInitializer();
        resultObject[cleanPropertyName] = this.parsePropertyValue(propertyValue);
      } else if (Node.isSpreadAssignment(property)) {
        // Handle spread assignments in config objects
        const spreadExpression = property.getExpression();
        const spreadKey = `...${spreadExpression.getText()}`;
        
        // Store the spread with a special key for later reconstruction
        resultObject[spreadKey] = undefined;
      }
    }

    return resultObject;
  }

  /**
   * Parses a TSMorph Node into its corresponding JavaScript value.
   * Handles all common ESLint configuration value types including primitives, 
   * arrays, objects, and dynamic imports.
   * 
   * @param valueNode - The TSMorph node to parse
   * @returns The parsed JavaScript value
   * @private
   */
  private parsePropertyValue(valueNode: Node | undefined): unknown {
    if (!valueNode) {
      return undefined;
    }

    // Handle primitive literals
    if (Node.isStringLiteral(valueNode)) {
      return valueNode.getLiteralValue();
    }
    
    if (Node.isNumericLiteral(valueNode)) {
      return valueNode.getLiteralValue();
    }
    
    // Handle keyword literals
    const nodeKind = valueNode.getKind();
    if (nodeKind === SyntaxKind.TrueKeyword) return true;
    if (nodeKind === SyntaxKind.FalseKeyword) return false;
    if (nodeKind === SyntaxKind.NullKeyword) return null;
    if (nodeKind === SyntaxKind.UndefinedKeyword) return undefined;
    
    // Handle undefined identifier
    if (Node.isIdentifier(valueNode) && valueNode.getText() === 'undefined') {
      return undefined;
    }
    
    // Handle complex types
    if (Node.isArrayLiteralExpression(valueNode)) {
      return valueNode.getElements().map(element => this.parsePropertyValue(element));
    }
    
    if (Node.isObjectLiteralExpression(valueNode)) {
      return this.parseObjectLiteral(valueNode);
    }
    
    // Handle dynamic imports (await import(...))
    if (Node.isAwaitExpression(valueNode)) {
      const awaitedExpression = valueNode.getExpression();
      if (Node.isCallExpression(awaitedExpression)) {
        const dynamicImport = this.parseDynamicImport(awaitedExpression);
        // If we can't parse the dynamic import, fall back to text representation
        return dynamicImport || valueNode.getText();
      }
    }

    // Fallback to text representation for complex expressions
    return valueNode.getText();
  }

  /**
   * Parses dynamic import expressions like import('module-name').
   * 
   * @param callExpression - The call expression to parse
   * @returns Special object representing dynamic import or undefined
   * @private
   */
  private parseDynamicImport(callExpression: CallExpression): { __dynamicImport: string } | undefined {
    const expression = callExpression.getExpression();
    const callArguments = callExpression.getArguments();
    
    // Check for import expression or import identifier
    const isImportExpression = Node.isImportExpression(expression) || 
                              (Node.isIdentifier(expression) && expression.getText() === 'import');
    
    if (isImportExpression && callArguments.length > 0) {
      const firstArg = callArguments[0];
      if (Node.isStringLiteral(firstArg)) {
        return { __dynamicImport: firstArg.getLiteralValue() };
      }
    }
    
    return undefined;
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
      for (const [key, value] of Object.entries(obj)) {
        // Handle spread operators - keys starting with '...'
        if (key.startsWith('...')) {
          properties.push(key); // Key already includes '...' prefix
        } else {
          properties.push(`'${key}': ${this.valueToString(value)}`);
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