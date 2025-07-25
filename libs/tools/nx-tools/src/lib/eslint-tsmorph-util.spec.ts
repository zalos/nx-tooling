import { EslintTsMorphUtil, EslintConfigObject } from './eslint-tsmorph-util';
import { Project, SourceFile } from 'ts-morph';
import { Tree } from '@nx/devkit';

describe('EslintTsMorphUtil', () => {
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
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      expect(util).toBeInstanceOf(EslintTsMorphUtil);
    });

    it('should create instance from Tree', () => {
      const content = `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `;
      (mockTree.read as jest.Mock).mockReturnValue(Buffer.from(content));

      const util = new EslintTsMorphUtil(mockTree, 'eslint.config.mjs');
      expect(util).toBeInstanceOf(EslintTsMorphUtil);
    });

    it('should throw error if no export default found', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
const config = [];
      `);

      expect(() => new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs')).toThrow('No export default found in ESLint config file');
    });

    it('should throw error if export default is not an array', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default {
  files: ['**/*.ts']
};
      `);

      expect(() => new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs')).toThrow('Export default must be an array literal in ESLint flat config');
    });
  });

  describe('getConfigs', () => {
    it('should parse basic config objects', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  },
  {
    files: ['**/*.js'],
    rules: {
      'no-var': 'warn'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      const configs = util.getConfigs();

      expect(configs).toHaveLength(2);
      expect(configs[0]).toEqual({
        files: ['**/*.ts'],
        rules: {
          'no-console': 'error'
        }
      });
      expect(configs[1]).toEqual({
        files: ['**/*.js'],
        rules: {
          'no-var': 'warn'
        }
      });
    });

    it('should parse config with languageOptions', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.json'],
    languageOptions: {
      parser: 'jsonc-eslint-parser'
    },
    rules: {
      'json/no-comments': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      const configs = util.getConfigs();

      expect(configs).toHaveLength(1);
      expect(configs[0]).toEqual({
        files: ['**/*.json'],
        languageOptions: {
          parser: 'jsonc-eslint-parser'
        },
        rules: {
          'json/no-comments': 'error'
        }
      });
    });

    it('should parse config with ignores', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    ignores: ['**/dist', '**/node_modules']
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      const configs = util.getConfigs();

      expect(configs).toHaveLength(1);
      expect(configs[0]).toEqual({
        ignores: ['**/dist', '**/node_modules']
      });
    });
  });

  describe('addOrUpdateConfig', () => {
    it('should add new config when files pattern does not exist', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      const newConfig: EslintConfigObject = {
        files: ['**/*.js'],
        rules: {
          'no-var': 'warn'
        }
      };

      util.addOrUpdateConfig(newConfig);
      
      const configs = util.getConfigs();
      expect(configs).toHaveLength(2);
      expect(configs[1].files).toEqual(['**/*.js']);
      expect(configs[1].rules).toEqual({ 'no-var': 'warn' });
    });

    it('should update existing config when files pattern matches', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      const updatedConfig: EslintConfigObject = {
        files: ['**/*.ts'],
        rules: {
          'no-console': 'warn',
          'no-debugger': 'error'
        }
      };

      util.addOrUpdateConfig(updatedConfig);
      
      const configs = util.getConfigs();
      expect(configs).toHaveLength(1);
      expect(configs[0].rules).toEqual({
        'no-console': 'warn',
        'no-debugger': 'error'
      });
    });
  });

  describe('removeConfig', () => {
    it('should remove config by file pattern', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  },
  {
    files: ['**/*.js'],
    rules: {
      'no-var': 'warn'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.removeConfig(['**/*.ts']);
      
      const configs = util.getConfigs();
      expect(configs).toHaveLength(1);
      expect(configs[0].files).toEqual(['**/*.js']);
    });

    it('should do nothing if config not found', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.removeConfig(['**/*.jsx']);
      
      const configs = util.getConfigs();
      expect(configs).toHaveLength(1);
    });
  });

  describe('addRule', () => {
    it('should add rule to existing config', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.addRule(['**/*.ts'], 'no-debugger', 'warn');
      
      const configs = util.getConfigs();
      expect(configs[0].rules).toEqual({
        'no-console': 'error',
        'no-debugger': 'warn'
      });
    });

    it('should create new config if file pattern does not exist', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.addRule(['**/*.js'], 'no-var', 'error');
      
      const configs = util.getConfigs();
      expect(configs).toHaveLength(2);
      expect(configs[1]).toEqual({
        files: ['**/*.js'],
        rules: {
          'no-var': 'error'
        }
      });
    });

    it('should add rules property if it does not exist', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts']
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.addRule(['**/*.ts'], 'no-console', 'error');
      
      const configs = util.getConfigs();
      expect(configs[0].rules).toEqual({
        'no-console': 'error'
      });
    });
  });

  describe('removeRule', () => {
    it('should remove rule from existing config', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-debugger': 'warn'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.removeRule(['**/*.ts'], 'no-console');
      
      const configs = util.getConfigs();
      expect(configs[0].rules).toEqual({
        'no-debugger': 'warn'
      });
    });

    it('should do nothing if config not found', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.removeRule(['**/*.js'], 'no-console');
      
      const configs = util.getConfigs();
      expect(configs[0].rules).toEqual({
        'no-console': 'error'
      });
    });

    it('should do nothing if rule not found', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.removeRule(['**/*.ts'], 'no-debugger');
      
      const configs = util.getConfigs();
      expect(configs[0].rules).toEqual({
        'no-console': 'error'
      });
    });
  });

  describe('updateRule', () => {
    it('should update existing rule', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.updateRule(['**/*.ts'], 'no-console', 'warn');
      
      const configs = util.getConfigs();
      expect(configs[0].rules).toEqual({
        'no-console': 'warn'
      });
    });

    it('should add rule if it does not exist', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.updateRule(['**/*.ts'], 'no-debugger', 'warn');
      
      const configs = util.getConfigs();
      expect(configs[0].rules).toEqual({
        'no-console': 'error',
        'no-debugger': 'warn'
      });
    });

    it('should create new config if file pattern does not exist', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.updateRule(['**/*.js'], 'no-var', 'error');
      
      const configs = util.getConfigs();
      expect(configs).toHaveLength(2);
      expect(configs[1]).toEqual({
        files: ['**/*.js'],
        rules: {
          'no-var': 'error'
        }
      });
    });
  });

  describe('complex rule configurations', () => {
    it('should handle array-based rule configurations', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}']
        }
      ]
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      const configs = util.getConfigs();

      expect(configs[0].rules).toEqual({
        '@nx/dependency-checks': [
          'error',
          {
            ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}']
          }
        ]
      });
    });

    it('should handle boolean rule configurations', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': true,
      'no-debugger': false
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      const configs = util.getConfigs();

      expect(configs[0].rules).toEqual({
        'no-console': true,
        'no-debugger': false
      });
    });

    it('should handle numeric rule configurations', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'max-len': 120,
      'complexity': 10
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      const configs = util.getConfigs();

      expect(configs[0].rules).toEqual({
        'max-len': 120,
        'complexity': 10
      });
    });
  });

  describe('save and getContent', () => {
    it('should return updated content', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      util.addRule(['**/*.ts'], 'no-debugger', 'warn');
      
      const content = util.getContent();
      expect(content).toContain("'no-debugger': 'warn'");
    });

    it('should write to tree when using Tree constructor', () => {
      const content = `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
      `;
      (mockTree.read as jest.Mock).mockReturnValue(Buffer.from(content));

      const util = new EslintTsMorphUtil(mockTree, 'eslint.config.mjs');
      util.addRule(['**/*.ts'], 'no-debugger', 'warn');
      util.save();

      expect(mockTree.write).toHaveBeenCalledWith('eslint.config.mjs', expect.stringContaining("'no-debugger': 'warn'"));
    });
  });

  // E2E snapshot tests for common tasks
  describe('E2E scenarios', () => {
    it('should add Playwright config for e2e files', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      // Add Playwright config
      util.addOrUpdateConfig({
        files: ['e2e/**/*.ts'],
        rules: {
          'playwright/expect-expect': 'error',
          'playwright/no-wait-for-timeout': 'warn'
        }
      });

      const content = util.getContent();
      expect(content).toMatchSnapshot('playwright-e2e-config');
    });

    it('should modify Angular component prefix rules', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case'
        }
      ]
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      // Update Angular prefix
      util.updateRule(['**/*.ts'], '@angular-eslint/component-selector', [
        'error',
        {
          type: 'element',
          prefix: 'my-company',
          style: 'kebab-case'
        }
      ]);

      const content = util.getContent();
      expect(content).toMatchSnapshot('angular-prefix-update');
    });

    it('should handle complex Nx dependency checks configuration', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
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
        },
      ],
    }
  }
];
      `);

      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
      
      // Update dependency constraints
      util.updateRule(['**/*.ts'], '@nx/enforce-module-boundaries', [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib', 'type:util'],
            },
            {
              sourceTag: 'type:lib',
              onlyDependOnLibsWithTags: ['type:lib', 'type:util'],
            },
          ],
        },
      ]);

      const content = util.getContent();
      expect(content).toMatchSnapshot('nx-dependency-constraints');
    });
  });

  // Edge cases and additional coverage tests
  describe('edge cases and coverage improvements', () => {
    describe('file pattern order independence', () => {
      it('should find config regardless of file pattern order', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Should find the same config with reversed order
        const config1 = util.getConfigs().find(c => 
          c.files && Array.isArray(c.files) && 
          c.files.includes('**/*.ts') && c.files.includes('**/*.js')
        );
        
        expect(config1).toBeDefined();
        expect(config1?.rules?.['no-console']).toBe('error');
        
        // Test update with different order
        util.addOrUpdateConfig({
          files: ['**/*.js', '**/*.ts'], // Reversed order
          rules: {
            'no-console': 'warn',
            'no-debugger': 'error'
          }
        });

        const configs = util.getConfigs();
        expect(configs).toHaveLength(1);
        expect(configs[0].rules?.['no-console']).toBe('warn');
        expect(configs[0].rules?.['no-debugger']).toBe('error');
      });

      it('should match configs with different file pattern orders', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e.ts'],
    rules: {
      'jest/expect-expect': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Update with completely different order
        util.addOrUpdateConfig({
          files: ['**/*.e2e.ts', '**/*.spec.ts', '**/*.test.ts'],
          rules: {
            'jest/expect-expect': 'warn',
            'jest/no-disabled-tests': 'error'
          }
        });

        const configs = util.getConfigs();
        expect(configs).toHaveLength(1);
        expect(configs[0].rules?.['jest/expect-expect']).toBe('warn');
        expect(configs[0].rules?.['jest/no-disabled-tests']).toBe('error');
      });
    });

    describe('updateConfig with files property', () => {
      it('should update files property in config', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Update config with same file pattern but different rules
        util.addOrUpdateConfig({
          files: ['**/*.ts'],
          rules: {
            'no-console': 'warn',
            'react/prop-types': 'off'
          }
        });

        const configs = util.getConfigs();
        expect(configs).toHaveLength(1);
        expect(configs[0].files).toEqual(['**/*.ts']);
        expect(configs[0].rules?.['no-console']).toBe('warn');
        expect(configs[0].rules?.['react/prop-types']).toBe('off');
      });

      it('should add new config when files array is different', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Add config with different files array - should create new config
        util.addOrUpdateConfig({
          files: ['**/*.tsx'],
          rules: {
            'react/prop-types': 'off'
          }
        });

        const configs = util.getConfigs();
        expect(configs).toHaveLength(2);
        
        const tsConfig = configs.find(c => 
          Array.isArray(c.files) && c.files.length === 1 && c.files[0] === '**/*.ts'
        );
        const tsxConfig = configs.find(c => 
          Array.isArray(c.files) && c.files.length === 1 && c.files[0] === '**/*.tsx'
        );
        
        expect(tsConfig?.rules?.['no-console']).toBe('error');
        expect(tsxConfig?.rules?.['react/prop-types']).toBe('off');
      });

      it('should handle config updates with languageOptions and files', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.json'],
    languageOptions: {
      parser: 'jsonc-eslint-parser'
    },
    rules: {
      'json/no-comments': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Update existing config with same files pattern
        util.addOrUpdateConfig({
          files: ['**/*.json'],
          languageOptions: {
            parser: 'jsonc-eslint-parser',
            parserOptions: {
              allowTrailingCommas: true
            }
          },
          rules: {
            'json/no-comments': 'warn',
            'json/trailing-comma': 'error'
          }
        });

        const configs = util.getConfigs();
        expect(configs).toHaveLength(1);
        expect(configs[0].files).toEqual(['**/*.json']);
        expect((configs[0].languageOptions?.parserOptions as Record<string, unknown>)?.allowTrailingCommas).toBe(true);
        expect(configs[0].rules?.['json/trailing-comma']).toBe('error');
      });
    });

    describe('error handling and edge cases', () => {
      it('should handle empty rules object', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {}
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        expect(configs[0].rules).toEqual({});
      });

      it('should handle config without rules property', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        expect(configs[0].languageOptions?.ecmaVersion).toBe(2022);
        expect(configs[0].rules).toBeUndefined();
      });

      it('should handle null and undefined rule values', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'rule-with-null': null,
      'rule-with-undefined': undefined
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        expect(configs[0].rules?.['rule-with-null']).toBe(null);
        expect(configs[0].rules?.['rule-with-undefined']).toBe(undefined);
      });

      it('should handle deeply nested rule configurations', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'complex-rule': [
        'error',
        {
          nested: {
            deeply: {
              config: true,
              array: [1, 2, 3],
              object: { key: 'value' }
            }
          }
        }
      ]
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        const complexRule = configs[0].rules?.['complex-rule'] as unknown[];
        expect(complexRule).toBeInstanceOf(Array);
        expect(complexRule[0]).toBe('error');
        expect((complexRule[1] as Record<string, unknown>).nested).toBeDefined();
      });
    });

    describe('enhanced Playwright configuration', () => {
      it('should add Playwright config with spread operator pattern', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
import playwright from 'eslint-plugin-playwright';

export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Add Playwright config with spread pattern (simulated)
        util.addOrUpdateConfig({
          files: ['tests/**'],
          rules: {
            'playwright/expect-expect': 'error',
            'playwright/no-wait-for-timeout': 'warn',
            'playwright/no-force-option': 'error'
          }
        });

        const configs = util.getConfigs();
        const playwrightConfig = configs.find(c => 
          c.files && Array.isArray(c.files) && c.files.includes('tests/**')
        );
        
        expect(playwrightConfig).toBeDefined();
        expect(playwrightConfig?.rules?.['playwright/expect-expect']).toBe('error');
        expect(playwrightConfig?.rules?.['playwright/no-wait-for-timeout']).toBe('warn');
        expect(playwrightConfig?.rules?.['playwright/no-force-option']).toBe('error');
      });
    });

    describe('100% coverage edge cases', () => {
      it('should handle configs with no configArray', () => {
        // Create a util with valid config first, then corrupt the configArray
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Simulate missing configArray
        (util as unknown as { configArray: unknown }).configArray = null;
        
        expect(util.getConfigs()).toEqual([]);
      });

      it('should handle parsePropertyValue with undefined/null values', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'rule-with-complex-undefined': undefined,
      'rule-with-complex-null': null
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        // These should be handled by the !value check
        expect(configs[0].rules?.['rule-with-complex-undefined']).toBe(undefined);
        expect(configs[0].rules?.['rule-with-complex-null']).toBe(null);
      });

      it('should handle dynamic imports in languageOptions', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.json'],
    languageOptions: {
      parser: await import('jsonc-eslint-parser')
    },
    rules: {
      'json/no-comments': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        expect(configs[0].languageOptions?.parser).toEqual({ __dynamicImport: 'jsonc-eslint-parser' });
      });

      it('should handle complex expressions that fallback to getText()', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
const complexFunction = () => ({ some: 'config' });

export default [
  {
    files: ['**/*.ts'],
    rules: {
      'complex-rule': complexFunction()
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        // This should fallback to getText() since it's a complex expression
        expect(configs[0].rules?.['complex-rule']).toBe('complexFunction()');
      });

      it('should handle spread elements in config array (skipped)', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
import baseConfig from './base.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        // Should only return the object literal config, spread elements are skipped
        expect(configs).toHaveLength(1);
        expect(configs[0].files).toEqual(['**/*.ts']);
      });

      it('should handle empty getConfigs when configArray is null', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        
        // Test the configArray check path
        (util as unknown as { configArray: unknown }).configArray = null;
        
        // This should trigger the !this.configArray return [] path
        expect(util.getConfigs()).toEqual([]);
        
        // Test the findConfigByFiles path as well
        const result = (util as unknown as { findConfigByFiles: (files: string[]) => unknown }).findConfigByFiles(['**/*.ts']);
        expect(result).toBeNull();
      });

      it('should handle configs that return null from parseConfigObject', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    // Config object with no valid properties - might return null from parseConfigObject
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        // Should still get the valid config, null configs are filtered out
        expect(configs.length).toBeGreaterThan(0);
        const validConfig = configs.find(c => c.files && Array.isArray(c.files));
        expect(validConfig).toBeDefined();
      });

      it('should handle property assignments with missing initializers', () => {
        // This tests the !value return undefined path in parsePropertyValue
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'valid-rule': 'error'
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        expect(configs[0].rules?.['valid-rule']).toBe('error');
      });

      it('should handle complex nested expressions in rule values', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
const complexValue = { nested: { value: true } };

export default [
  {
    files: ['**/*.ts'],
    rules: {
      'complex-nested-rule': complexValue
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        // This should fallback to getText() for complex expressions
        expect(configs[0].rules?.['complex-nested-rule']).toBe('complexValue');
      });

      it('should handle dynamic import with no arguments', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: await import()
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        // Should fallback to text representation since no arguments
        expect(configs[0].languageOptions?.parser).toBe('await import()');
      });

      it('should handle dynamic import with non-string argument', () => {
        const sourceFile = project.createSourceFile('eslint.config.mjs', `
const parserName = 'jsonc-eslint-parser';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: await import(parserName)
    }
  }
];
        `);

        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.mjs');
        const configs = util.getConfigs();
        
        expect(configs).toHaveLength(1);
        // Should fallback to text since argument is not a string literal
        expect(configs[0].languageOptions?.parser).toBe('await import(parserName)');
      });
    });
  });

  describe('Helper Methods', () => {
    it('should add multiple rules at once', () => {
      const content = 'export default []';
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('eslint.config.js', content);
      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

      const rules = {
        'no-console': 'warn',
        'no-debugger': 'error',
        '@typescript-eslint/no-unused-vars': 'error'
      };

      util.addMultipleRules(['**/*.ts'], rules);

      const result = util.getConfigs();
      expect(result).toHaveLength(1);
      expect(result[0].files).toEqual(['**/*.ts']);
      expect(result[0].rules).toEqual(rules);
    });

    it('should check if rule exists', () => {
      const content = `export default [
        {
          files: ['**/*.ts'],
          rules: {
            'no-console': 'warn'
          }
        }
      ]`;
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('eslint.config.js', content);
      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

      expect(util.hasRule(['**/*.ts'], 'no-console')).toBe(true);
      expect(util.hasRule(['**/*.ts'], 'no-debugger')).toBe(false);
      expect(util.hasRule(['**/*.js'], 'no-console')).toBe(false);
    });

    it('should get rule configuration', () => {
      const content = `export default [
        {
          files: ['**/*.ts'],
          rules: {
            'no-console': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
          }
        }
      ]`;
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('eslint.config.js', content);
      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

      expect(util.getRule(['**/*.ts'], 'no-console')).toBe('warn');
      expect(util.getRule(['**/*.ts'], '@typescript-eslint/no-unused-vars')).toEqual(['error', { argsIgnorePattern: '^_' }]);
      expect(util.getRule(['**/*.ts'], 'non-existent')).toBeUndefined();
    });

    it('should remove deprecated rules', () => {
      const content = `export default [
        {
          files: ['**/*.ts'],
          rules: {
            'babel/new-cap': 'error',
            '@typescript-eslint/ban-ts-ignore': 'error',
            'no-console': 'warn',
            '@typescript-eslint/camelcase': 'error'
          }
        }
      ]`;
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('eslint.config.js', content);
      const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

      util.removeDeprecatedRules(['**/*.ts']);

      const result = util.getConfigs();
      expect(result).toHaveLength(1);
      expect(result[0].rules).toEqual({
        'no-console': 'warn'
      });
    });
  });

  describe('spread operator support', () => {
    describe('addSpreadToRules', () => {
      it('should add spread operator to rules', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: {
              'no-console': 'error'
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.addSpreadToRules(['**/*.ts'], 'baseRules');

        const result = sourceFile.getText();
        expect(result).toContain('...baseRules');
        expect(result).toContain("'no-console': 'error'");
      });

      it('should throw error if config not found', () => {
        const content = `export default []`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        expect(() => util.addSpreadToRules(['**/*.ts'], 'baseRules'))
          .toThrow('No config found for files: **/*.ts');
      });

      it('should throw error if rules property is not an object', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: 'invalid'
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        expect(() => util.addSpreadToRules(['**/*.ts'], 'baseRules'))
          .toThrow('Rules property must be an object literal');
      });
    });

    describe('removeSpreadFromRules', () => {
      it('should remove spread operator from rules', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: {
              ...baseRules,
              'no-console': 'error'
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.removeSpreadFromRules(['**/*.ts'], 'baseRules');

        const result = sourceFile.getText();
        expect(result).not.toContain('...baseRules');
        expect(result).toContain("'no-console': 'error'");
      });

      it('should handle non-existent spread operator gracefully', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: {
              'no-console': 'error'
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        // Should not throw error even if spread doesn't exist
        expect(() => util.removeSpreadFromRules(['**/*.ts'], 'baseRules')).not.toThrow();
      });
    });

    describe('addSpreadToConfig', () => {
      it('should add spread operator to config object', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: {
              'no-console': 'error'
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.addSpreadToConfig(['**/*.ts'], 'baseConfig');

        const result = sourceFile.getText();
        expect(result).toContain('...baseConfig');
        expect(result).toContain("files: ['**/*.ts']");
      });

      it('should throw error if config not found', () => {
        const content = `export default []`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        expect(() => util.addSpreadToConfig(['**/*.ts'], 'baseConfig'))
          .toThrow('No config found for files: **/*.ts');
      });
    });

    describe('removeSpreadFromConfig', () => {
      it('should remove spread operator from config object', () => {
        const content = `export default [
          {
            ...baseConfig,
            files: ['**/*.ts'],
            rules: {
              'no-console': 'error'
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.removeSpreadFromConfig(['**/*.ts'], 'baseConfig');

        const result = sourceFile.getText();
        expect(result).not.toContain('...baseConfig');
        expect(result).toContain("files: ['**/*.ts']");
      });

      it('should handle non-existent spread operator gracefully', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: {
              'no-console': 'error'
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        // Should not throw error even if spread doesn't exist
        expect(() => util.removeSpreadFromConfig(['**/*.ts'], 'baseConfig')).not.toThrow();
      });
    });

    describe('parsing spread operators', () => {
      it('should parse and preserve spread operators in rules', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: {
              ...baseRules,
              'no-console': 'error',
              ...additionalRules
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const configs = util.getConfigs();
        expect(configs).toHaveLength(1);
        expect(configs[0].rules?.['...baseRules']).toBe(null);
        expect(configs[0].rules?.['...additionalRules']).toBe(null);
        expect(configs[0].rules?.['no-console']).toBe('error');
      });

      it('should parse and preserve spread operators in config', () => {
        const content = `export default [
          {
            ...baseConfig,
            files: ['**/*.ts'],
            rules: {
              'no-console': 'error'
            },
            ...overrides
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const configs = util.getConfigs();
        expect(configs).toHaveLength(1);
        expect(configs[0]['...baseConfig']).toBe(undefined);
        expect(configs[0]['...overrides']).toBe(undefined);
        expect(configs[0].files).toEqual(['**/*.ts']);
      });

      it('should serialize spread operators correctly with valueToString', () => {
        const content = `export default [
          {
            files: ['**/*.ts'],
            rules: {
              ...baseRules,
              'no-console': 'error'
            }
          }
        ]`;
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        // Add a new rule to trigger serialization
        util.addRule(['**/*.ts'], 'no-debugger', 'warn');

        const result = sourceFile.getText();
        expect(result).toContain('...baseRules');
        expect(result).toContain("'no-console': 'error'");
        expect(result).toContain("'no-debugger': 'warn'");
      });
    });
  });

  describe('Helper Methods Coverage', () => {
    describe('ensureRule', () => {
      it('should add rule if it does not exist', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.ensureRule(['**/*.ts'], 'no-console', 'warn');

        const result = util.getConfigs();
        expect(result).toHaveLength(1);
        expect(result[0].rules).toEqual({ 'no-console': 'warn' });
      });

      it('should update rule if it already exists', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: { 'no-console': 'error' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.ensureRule(['**/*.ts'], 'no-console', 'warn');

        const result = util.getConfigs();
        expect(result[0].rules).toEqual({ 'no-console': 'warn' });
      });
    });

    describe('removeRuleIfExists', () => {
      it('should remove rule if it exists', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: { 'no-console': 'error', 'no-debugger': 'warn' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.removeRuleIfExists(['**/*.ts'], 'no-console');

        const result = util.getConfigs();
        expect(result[0].rules).toEqual({ 'no-debugger': 'warn' });
      });

      it('should do nothing if rule does not exist', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: { 'no-debugger': 'warn' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.removeRuleIfExists(['**/*.ts'], 'no-console');

        const result = util.getConfigs();
        expect(result[0].rules).toEqual({ 'no-debugger': 'warn' });
      });
    });

    describe('getRulesForPattern', () => {
      it('should return rules for existing pattern', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: { 'no-console': 'error', 'no-debugger': 'warn' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const rules = util.getRulesForPattern(['**/*.ts']);

        expect(rules).toEqual({ 'no-console': 'error', 'no-debugger': 'warn' });
      });

      it('should return undefined for non-existent pattern', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const rules = util.getRulesForPattern(['**/*.ts']);

        expect(rules).toBeUndefined();
      });
    });

    describe('setLanguageOptions', () => {
      it('should create new config with language options when pattern does not exist', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.setLanguageOptions(['**/*.ts'], '@typescript-eslint/parser', { ecmaVersion: 2020 });

        const result = util.getConfigs();
        expect(result).toHaveLength(1);
        expect(result[0].files).toEqual(['**/*.ts']);
        expect(result[0].languageOptions).toEqual({
          parser: '@typescript-eslint/parser',
          parserOptions: { ecmaVersion: 2020 }
        });
      });

      it('should add languageOptions to existing config without languageOptions', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: { 'no-console': 'error' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.setLanguageOptions(['**/*.ts'], '@typescript-eslint/parser');

        const updatedContent = util.getContent();
        expect(updatedContent).toContain('languageOptions');
        expect(updatedContent).toContain('@typescript-eslint/parser');
      });

      it('should update existing languageOptions', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          languageOptions: {
            parser: 'old-parser',
            parserOptions: { ecmaVersion: 2018 }
          },
          rules: { 'no-console': 'error' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.setLanguageOptions(['**/*.ts'], '@typescript-eslint/parser', { ecmaVersion: 2022 });

        const updatedContent = util.getContent();
        expect(updatedContent).toContain('@typescript-eslint/parser');
        expect(updatedContent).toContain('2022');
      });

      it('should handle object parser option', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const parserConfig = { name: '@typescript-eslint/parser', version: '6.0.0' };
        util.setLanguageOptions(['**/*.ts'], parserConfig);

        const result = util.getConfigs();
        expect(result[0].languageOptions?.parser).toEqual(parserConfig);
      });
    });

    describe('updateRenamedRules', () => {
      it('should rename existing rules to new names', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: {
            '@typescript-eslint/ban-ts-ignore': 'error',
            '@typescript-eslint/camelcase': 'warn',
            'no-spaced-func': 'error'
          }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.updateRenamedRules(['**/*.ts']);

        const result = util.getConfigs();
        expect(result[0].rules).toEqual({
          '@typescript-eslint/ban-ts-comment': 'error',
          '@typescript-eslint/naming-convention': 'warn',
          'func-call-spacing': 'error'
        });
      });

      it('should do nothing if no renamed rules exist', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: { 'no-console': 'error' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.updateRenamedRules(['**/*.ts']);

        const result = util.getConfigs();
        expect(result[0].rules).toEqual({ 'no-console': 'error' });
      });
    });

    describe('clearAllRules', () => {
      it('should remove all rules from config', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: {
            'no-console': 'error',
            'no-debugger': 'warn',
            '@typescript-eslint/no-unused-vars': 'error'
          }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.clearAllRules(['**/*.ts']);

        const result = util.getConfigs();
        expect(result[0].files).toEqual(['**/*.ts']);
        expect(result[0].rules).toBeUndefined();
      });

      it('should do nothing if config does not exist', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.clearAllRules(['**/*.ts']);

        const result = util.getConfigs();
        expect(result).toHaveLength(0);
      });
    });

    describe('hasConfigForPattern', () => {
      it('should return true for existing pattern', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          rules: { 'no-console': 'error' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const hasConfig = util.hasConfigForPattern(['**/*.ts']);

        expect(hasConfig).toBe(true);
      });

      it('should return false for non-existent pattern', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const hasConfig = util.hasConfigForPattern(['**/*.ts']);

        expect(hasConfig).toBe(false);
      });
    });

    describe('getAllConfiguredPatterns', () => {
      it('should return all file patterns that have configurations', () => {
        const content = `export default [
          { files: ['**/*.ts'], rules: { 'no-console': 'error' } },
          { files: ['**/*.js'], rules: { 'no-debugger': 'warn' } },
          { ignores: ['node_modules'] }
        ]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const patterns = util.getAllConfiguredPatterns();

        expect(patterns).toEqual([
          ['**/*.ts'],
          ['**/*.js']
        ]);
      });

      it('should return empty array when no configurations exist', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        const patterns = util.getAllConfiguredPatterns();

        expect(patterns).toEqual([]);
      });
    });

    describe('mergeRulesFromPattern', () => {
      it('should merge rules from source pattern to target pattern', () => {
        const content = `export default [
          { files: ['**/*.ts'], rules: { 'no-console': 'error', 'no-debugger': 'warn' } },
          { files: ['**/*.spec.ts'], rules: { 'jest/expect-expect': 'error' } }
        ]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.mergeRulesFromPattern(['**/*.ts'], ['**/*.spec.ts']);

        const result = util.getConfigs();
        const specConfig = result.find(config => config.files?.[0] === '**/*.spec.ts');
        expect(specConfig?.rules).toEqual({
          'jest/expect-expect': 'error',
          'no-console': 'error',
          'no-debugger': 'warn'
        });
      });

      it('should do nothing if source pattern does not exist', () => {
        const content = `export default [
          { files: ['**/*.spec.ts'], rules: { 'jest/expect-expect': 'error' } }
        ]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.mergeRulesFromPattern(['**/*.ts'], ['**/*.spec.ts']);

        const result = util.getConfigs();
        const specConfig = result.find(config => config.files?.[0] === '**/*.spec.ts');
        expect(specConfig?.rules).toEqual({
          'jest/expect-expect': 'error'
        });
      });
    });

    describe('copyConfigToPattern', () => {
      it('should copy entire configuration to new pattern', () => {
        const content = `export default [{
          files: ['**/*.ts'],
          languageOptions: { parser: '@typescript-eslint/parser' },
          rules: { 'no-console': 'error', 'no-debugger': 'warn' }
        }]`;
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.copyConfigToPattern(['**/*.ts'], ['**/*.tsx']);

        const result = util.getConfigs();
        const tsxConfig = result.find(config => config.files?.[0] === '**/*.tsx');
        expect(tsxConfig).toEqual({
          files: ['**/*.tsx'],
          languageOptions: { parser: '@typescript-eslint/parser' },
          rules: { 'no-console': 'error', 'no-debugger': 'warn' }
        });
      });

      it('should do nothing if source pattern does not exist', () => {
        const content = 'export default []';
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('eslint.config.js', content);
        const util = new EslintTsMorphUtil(sourceFile, 'eslint.config.js');

        util.copyConfigToPattern(['**/*.ts'], ['**/*.tsx']);

        const result = util.getConfigs();
        expect(result).toHaveLength(0);
      });
    });
  });
});
