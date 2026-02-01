import { describe, it, expect } from 'vitest';
import {
  analyzeComplexity,
  ComplexityTier,
  ComplexitySignals,
  ComplexityResult,
} from './complexity.js';

describe('ComplexityAnalyzer', () => {
  describe('analyzeComplexity', () => {
    describe('tier detection', () => {
      it('should detect trivial messages (greetings, simple questions)', () => {
        const trivialMessages = [
          'hi',
          'hello',
          'hey there',
          'what time is it?',
          'thanks',
          'ok',
          'yes',
          'no',
        ];

        for (const message of trivialMessages) {
          const result = analyzeComplexity(message);
          expect(result.tier).toBe(ComplexityTier.Trivial);
        }
      });

      it('should detect simple messages (basic requests, short questions)', () => {
        const simpleMessages = [
          'What is the capital of France?',
          'List the files in the current directory',
          'Show me the contents of package.json',
        ];

        for (const message of simpleMessages) {
          const result = analyzeComplexity(message);
          expect(result.tier).toBe(ComplexityTier.Simple);
        }
      });

      it('should detect moderate messages (multi-step tasks, code requests)', () => {
        const moderateMessages = [
          'Read the file config.ts and explain what it does',
          'Find all TypeScript files in src and count them',
          'Create a new function that validates email addresses',
        ];

        for (const message of moderateMessages) {
          const result = analyzeComplexity(message);
          expect(result.tier).toBe(ComplexityTier.Moderate);
        }
      });

      it('should detect complex messages (architecture, refactoring, debugging)', () => {
        const complexMessages = [
          'Refactor the entire authentication system to use JWT tokens instead of sessions. Update all related files.',
          'Debug this issue: the application crashes when processing large files. Investigate the memory usage and optimize.',
          'Design and implement a new caching layer with Redis support, including invalidation strategies and monitoring.',
        ];

        for (const message of complexMessages) {
          const result = analyzeComplexity(message);
          expect(result.tier).toBe(ComplexityTier.Complex);
        }
      });
    });

    describe('signal extraction', () => {
      it('should count tokens approximately', () => {
        const shortMessage = 'hello';
        const longMessage = 'This is a much longer message that contains many words and should have a higher token count';

        const shortResult = analyzeComplexity(shortMessage);
        const longResult = analyzeComplexity(longMessage);

        expect(shortResult.signals.estimatedTokens).toBeLessThan(10);
        expect(longResult.signals.estimatedTokens).toBeGreaterThan(15);
      });

      it('should detect code presence', () => {
        const noCode = 'Tell me about TypeScript';
        const withCode = 'What does this code do: `const x = 1;`';
        const withCodeBlock = `Explain this:
\`\`\`javascript
function add(a, b) {
  return a + b;
}
\`\`\``;

        expect(analyzeComplexity(noCode).signals.hasCode).toBe(false);
        expect(analyzeComplexity(withCode).signals.hasCode).toBe(true);
        expect(analyzeComplexity(withCodeBlock).signals.hasCode).toBe(true);
      });

      it('should detect complexity keywords', () => {
        const simpleMessage = 'What is TypeScript?';
        const complexMessage = 'Refactor and optimize the database layer architecture';

        const simpleResult = analyzeComplexity(simpleMessage);
        const complexResult = analyzeComplexity(complexMessage);

        expect(simpleResult.signals.complexityKeywords.length).toBe(0);
        expect(complexResult.signals.complexityKeywords.length).toBeGreaterThan(0);
        expect(complexResult.signals.complexityKeywords).toContain('refactor');
        expect(complexResult.signals.complexityKeywords).toContain('optimize');
        expect(complexResult.signals.complexityKeywords).toContain('architecture');
      });

      it('should predict tool usage', () => {
        const noTools = 'What is the weather?';
        const readTool = 'Show me the contents of README.md';
        const writeTool = 'Create a new file called test.js';
        const bashTool = 'Run npm install';
        const multiTools = 'Read package.json, update the version, and run npm test';

        expect(analyzeComplexity(noTools).signals.predictedTools).toEqual([]);
        expect(analyzeComplexity(readTool).signals.predictedTools).toContain('read');
        expect(analyzeComplexity(writeTool).signals.predictedTools).toContain('write');
        expect(analyzeComplexity(bashTool).signals.predictedTools).toContain('bash');
        expect(analyzeComplexity(multiTools).signals.predictedTools.length).toBeGreaterThan(1);
      });

      it('should detect multi-step indicators', () => {
        const singleStep = 'Read the file';
        const multiStep = 'First read the file, then analyze it, and finally create a summary';
        const andThen = 'Read the config and then update it';

        expect(analyzeComplexity(singleStep).signals.isMultiStep).toBe(false);
        expect(analyzeComplexity(multiStep).signals.isMultiStep).toBe(true);
        expect(analyzeComplexity(andThen).signals.isMultiStep).toBe(true);
      });
    });

    describe('confidence scoring', () => {
      it('should provide a confidence score between 0 and 1', () => {
        const messages = [
          'hi',
          'Read the file',
          'Refactor the entire system',
        ];

        for (const message of messages) {
          const result = analyzeComplexity(message);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      });

      it('should have higher confidence for clear-cut cases', () => {
        const trivial = analyzeComplexity('hello');
        const complex = analyzeComplexity('Refactor the entire authentication system with full test coverage');

        // Clear trivial and complex cases should have higher confidence
        expect(trivial.confidence).toBeGreaterThan(0.7);
        expect(complex.confidence).toBeGreaterThan(0.7);
      });
    });

    describe('suggested model', () => {
      it('should suggest a fast/cheap model for trivial tasks', () => {
        const result = analyzeComplexity('hi');
        expect(result.suggestedModelTier).toBe('fast');
      });

      it('should suggest a standard model for simple/moderate tasks', () => {
        const simpleResult = analyzeComplexity('What is TypeScript?');
        const moderateResult = analyzeComplexity('Create a function to validate emails');

        expect(['fast', 'standard']).toContain(simpleResult.suggestedModelTier);
        expect(moderateResult.suggestedModelTier).toBe('standard');
      });

      it('should suggest a capable model for complex tasks', () => {
        const result = analyzeComplexity('Refactor the entire architecture with new design patterns');
        expect(result.suggestedModelTier).toBe('capable');
      });
    });
  });
});
