import { Project } from 'ts-morph';
import { EslintTsMorphUtil } from './eslint-tsmorph-util';

// Test the specific spread operator pattern you mentioned
const project = new Project();
const sourceFile = project.createSourceFile('test-eslint.config.mjs', `
export default [
  {
    files: ['**/*.ts'],
    rules: {
      'prefer-const': 'error'
    }
  }
];
`);

const eslintUtil = new EslintTsMorphUtil(sourceFile, 'test-eslint.config.mjs');

// Try to add the Playwright config with spread operator in rules
try {
  eslintUtil.addOrUpdateConfig(['tests/**'], {
    '...playwright.configs[\'flat/recommended\']': true,
    files: ['tests/**'],
    rules: {
      '...playwright.configs[\'flat/recommended\'].rules': true,
      'playwright/expect-expect': 'error',
      'custom-rule': 'warn'
    }
  });

  console.log('SUCCESS: Configuration added');
  console.log('Result:');
  console.log(eslintUtil.getContent());
} catch (error) {
  console.log('ERROR:', error.message);
}
