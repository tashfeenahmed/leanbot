/**
 * Skill Installer
 * Downloads and installs skills from URLs or skill registries
 * Complements the SkillPackageManager API with local installation support
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type { Logger } from 'pino';
import { parseFrontmatter } from './parser.js';
import { checkGates } from './loader.js';
import type { Skill, SkillFrontmatter } from './types.js';

const DEFAULT_LOCAL_SKILLS_DIR = path.join(homedir(), '.leanbot', 'skills');

/**
 * Skill package metadata from registry
 */
export interface SkillPackage {
  name: string;
  description: string;
  version: string;
  author?: string;
  homepage?: string;
  downloadUrl: string;
  checksum?: string;
}

/**
 * Registry search result
 */
export interface SearchResult {
  packages: SkillPackage[];
  total: number;
}

/**
 * Installation result
 */
export interface InstallResult {
  success: boolean;
  skill?: Skill;
  error?: string;
  path?: string;
}

export interface SkillPackageManagerOptions {
  /** Base URL for skill registry (default: GitHub raw content) */
  registryUrl?: string;
  /** Local skills directory */
  skillsDir?: string;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Skill Installer for downloading and installing skills from URLs
 */
export class SkillPackageManager {
  private registryUrl: string;
  private skillsDir: string;
  private logger: Logger | null;

  constructor(options: SkillPackageManagerOptions = {}) {
    this.registryUrl = options.registryUrl || 'https://raw.githubusercontent.com/openclaw/skills/main';
    this.skillsDir = options.skillsDir || DEFAULT_LOCAL_SKILLS_DIR;
    this.logger = options.logger?.child({ module: 'clawhub' }) || null;
  }

  /**
   * Search for skills by query
   */
  async search(query: string): Promise<SearchResult> {
    try {
      // Fetch registry index
      const indexUrl = `${this.registryUrl}/index.json`;
      const response = await fetch(indexUrl);

      if (!response.ok) {
        this.logger?.warn({ status: response.status }, 'Failed to fetch registry index');
        return { packages: [], total: 0 };
      }

      const index = (await response.json()) as { skills: SkillPackage[] };
      const lowerQuery = query.toLowerCase();

      // Filter skills matching query
      const matches = index.skills.filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(lowerQuery) ||
          pkg.description.toLowerCase().includes(lowerQuery)
      );

      return {
        packages: matches,
        total: matches.length,
      };
    } catch (error) {
      this.logger?.error({ error: (error as Error).message }, 'Search failed');
      return { packages: [], total: 0 };
    }
  }

  /**
   * Get skill package info by name
   */
  async getPackage(name: string): Promise<SkillPackage | null> {
    try {
      const indexUrl = `${this.registryUrl}/index.json`;
      const response = await fetch(indexUrl);

      if (!response.ok) {
        return null;
      }

      const index = (await response.json()) as { skills: SkillPackage[] };
      return index.skills.find((pkg) => pkg.name === name) || null;
    } catch {
      return null;
    }
  }

  /**
   * Install a skill by name
   */
  async install(name: string): Promise<InstallResult> {
    this.logger?.info({ name }, 'Installing skill');

    try {
      // Get package info
      const pkg = await this.getPackage(name);
      if (!pkg) {
        // Try direct download from convention URL
        const directUrl = `${this.registryUrl}/skills/${name}/SKILL.md`;
        return this.installFromUrl(name, directUrl);
      }

      return this.installFromUrl(name, pkg.downloadUrl);
    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Install a skill from a URL
   */
  async installFromUrl(name: string, url: string): Promise<InstallResult> {
    try {
      // Fetch skill content
      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to download skill: HTTP ${response.status}`,
        };
      }

      const content = await response.text();

      // Validate skill format
      let parsed: { frontmatter: SkillFrontmatter; content: string };
      try {
        parsed = parseFrontmatter(content, url);
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid skill format: ${(parseError as Error).message}`,
        };
      }

      // Use name from frontmatter or provided name
      const skillName = parsed.frontmatter.name || name;

      // Create skill directory
      const skillDir = path.join(this.skillsDir, skillName);
      await fs.mkdir(skillDir, { recursive: true });

      // Write SKILL.md
      const skillPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillPath, content, 'utf-8');

      // Check gates
      const gateResult = checkGates(parsed.frontmatter.metadata);

      const skill: Skill = {
        name: skillName,
        description: parsed.frontmatter.description,
        path: skillPath,
        source: 'local',
        frontmatter: parsed.frontmatter,
        content: parsed.content,
        available: gateResult.available,
        unavailableReason: gateResult.reason,
      };

      this.logger?.info(
        { name: skillName, path: skillPath, available: skill.available },
        'Skill installed'
      );

      return {
        success: true,
        skill,
        path: skillPath,
      };
    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Uninstall a skill by name
   */
  async uninstall(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const skillDir = path.join(this.skillsDir, name);

      // Check if skill exists
      try {
        await fs.access(skillDir);
      } catch {
        return {
          success: false,
          error: `Skill not found: ${name}`,
        };
      }

      // Remove skill directory
      await fs.rm(skillDir, { recursive: true, force: true });

      this.logger?.info({ name }, 'Skill uninstalled');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Uninstall failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * List installed skills
   */
  async listInstalled(): Promise<string[]> {
    try {
      await fs.mkdir(this.skillsDir, { recursive: true });
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

      const skills: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check if SKILL.md exists
          const skillPath = path.join(this.skillsDir, entry.name, 'SKILL.md');
          try {
            await fs.access(skillPath);
            skills.push(entry.name);
          } catch {
            // Not a valid skill directory
          }
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  /**
   * Update a skill to latest version
   */
  async update(name: string): Promise<InstallResult> {
    // Simply reinstall - will overwrite existing
    return this.install(name);
  }

  /**
   * Update all installed skills
   */
  async updateAll(): Promise<Map<string, InstallResult>> {
    const results = new Map<string, InstallResult>();
    const installed = await this.listInstalled();

    for (const name of installed) {
      results.set(name, await this.update(name));
    }

    return results;
  }

  /**
   * Get skills directory path
   */
  getSkillsDir(): string {
    return this.skillsDir;
  }
}

/**
 * Create a ClawHub client with default options
 */
export function createSkillPackageManager(options?: SkillPackageManagerOptions): SkillPackageManager {
  return new SkillPackageManager(options);
}
