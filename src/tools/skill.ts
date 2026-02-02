/**
 * Skill Tool
 * Allows the agent to invoke skills from the skill registry
 */

import type { Tool, ToolContext, ToolResult } from './types.js';
import type { ToolDefinition } from '../providers/types.js';
import type { SkillRegistry } from '../skills/registry.js';

/**
 * Module-level registry reference (initialized via initializeSkillTool)
 */
let skillRegistry: SkillRegistry | null = null;

/**
 * Initialize the skill tool with a registry
 */
export function initializeSkillTool(registry: SkillRegistry): void {
  skillRegistry = registry;
}

/**
 * Get the current skill registry
 */
export function getSkillRegistry(): SkillRegistry | null {
  return skillRegistry;
}

/**
 * Skill Tool - invokes skills from the registry
 */
export class SkillTool implements Tool {
  name = 'Skill';
  category = 'meta' as const;
  description = 'Execute a skill by name. Skills provide specialized capabilities for common tasks.';

  definition: ToolDefinition = {
    name: 'Skill',
    description: this.description,
    input_schema: {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: 'The name of the skill to execute (e.g., "commit", "review-pr")',
        },
        args: {
          type: 'string',
          description: 'Optional arguments to pass to the skill',
        },
      },
      required: ['skill'],
    },
  };

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const skillName = input.skill as string;
    const args = input.args as string | undefined;

    if (!skillRegistry) {
      return {
        success: false,
        output: '',
        error: 'Skill registry not initialized',
      };
    }

    // Get skill from registry
    const skill = skillRegistry.getSkill(skillName);
    if (!skill) {
      const available = skillRegistry.getAvailableSkills();
      const suggestions = available
        .filter((s) => s.name.includes(skillName) || skillName.includes(s.name.slice(0, 3)))
        .slice(0, 3)
        .map((s) => s.name);

      return {
        success: false,
        output: '',
        error: `Skill not found: ${skillName}${suggestions.length > 0 ? `. Did you mean: ${suggestions.join(', ')}?` : ''}`,
      };
    }

    if (!skill.available) {
      return {
        success: false,
        output: '',
        error: `Skill "${skillName}" is not available: ${skill.unavailableReason || 'Unknown reason'}`,
      };
    }

    context.logger.debug({ skill: skillName, args }, 'Executing skill');

    // Execute the skill
    const result = await skillRegistry.executeSkill(skillName, {
      sessionId: context.sessionId,
      args,
    });

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || 'Skill execution failed',
      };
    }

    // Check for tool dispatch response
    if (result.output) {
      try {
        const parsed = JSON.parse(result.output);
        if (parsed.dispatch === 'tool') {
          // Return instruction for agent to invoke the specified tool
          return {
            success: true,
            output: `[Skill "${skillName}" requires invoking tool "${parsed.tool}"${parsed.args ? ` with args: ${parsed.args}` : ''}. Please invoke that tool now.]`,
          };
        }
      } catch {
        // Not JSON, treat as regular output
      }
    }

    // Return skill content for the model to process
    return {
      success: true,
      output: result.output || skill.content,
    };
  }
}
