# Factsets Integration Setup

This prompt guides agents through integrating Factsets into a new project or repository. The goal is thorough setup that saves tokens on every future interaction.

**Philosophy**: Spend tokens now to save tokens forever. Deep analysis during setup prevents repeated discovery costs.

## Pre-Setup Checklist

Before beginning integration, confirm:

- [ ] Factsets MCP server is available and connected
- [ ] You have read access to project files
- [ ] You can create/modify files in the workspace

If any of these are not confirmed, resolve them before proceeding.

---

## Phase 1: Deep Project Analysis

### 1.1 Saturate Factsets Knowledge

First, fully understand Factsets itself. Call these tools:

```json
{ "tool": "get_agent_guide" }
{ "tool": "get_concept_guide" }
{ "tool": "get_config_guide" }
{ "tool": "get_config_schema" }
{ "tool": "list_config" }
```

**Why**: You cannot integrate what you do not understand. Read all returned content carefully. These documents explain:

- Core concepts (facts, resources, skills, tags, execution logs)
- Headless operation philosophy
- Configuration options
- Workflow patterns
- Anti-patterns to avoid

### 1.2 Analyze Project Structure

Examine the project to understand its architecture:

1. **Entry points**: Find `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or equivalent
2. **Documentation**: Locate `README.md`, `/docs/` directories, wiki content
3. **Configuration**: Find linter configs, build configs, CI/CD workflows
4. **Source structure**: Map out `src/`, `lib/`, `app/`, etc directories
5. **Test structure**: Identify test directories and frameworks

**Actions**:

- Read key configuration files
- Understand the tech stack (languages, frameworks, tools)
- Identify the project's purpose and scope
- Note any existing AI/agent-related configuration

### 1.3 Establish Initial Facts

Submit facts about what you discover. This creates baseline knowledge:

```json
{
  "tool": "submit_facts",
  "facts": [
    {
      "content": "Project uses [runtime/framework] with [key tools]",
      "tags": ["project", "architecture"],
      "sourceType": "code",
      "verified": true
    },
    {
      "content": "Main entry point is [path]",
      "tags": ["project", "entry-point"],
      "sourceType": "code",
      "verified": true
    },
    {
      "content": "Test framework is [name], run with [command]",
      "tags": ["project", "testing"],
      "sourceType": "code",
      "verified": true
    }
  ]
}
```

**Key facts to capture**:

- Runtime/language version
- Package manager
- Build system
- Test framework and commands
- Linting/formatting tools
- Deployment method
- Key dependencies
- Project purpose/goal

### 1.4 Register Key Resources

Register configuration files and documentation as resources:

```json
{
  "tool": "add_resources",
  "resources": [
    {
      "uri": "./package.json",
      "type": "file",
      "description": "Package manifest with dependencies and scripts",
      "tags": ["project", "config"],
      "retrievalMethod": { "type": "file", "command": "cat package.json" }
    },
    {
      "uri": "./README.md",
      "type": "file",
      "description": "Project documentation and setup instructions",
      "tags": ["project", "documentation"],
      "retrievalMethod": { "type": "file", "command": "cat README.md" }
    }
  ]
}
```

### 1.5 Create Project Tags

Create descriptive tags for organization:

```json
{
  "tool": "create_tags",
  "tags": [
    {
      "name": "project",
      "description": "Core project knowledge and configuration"
    },
    { "name": "[project-name]", "description": "Specific to this project" },
    { "name": "[domain]", "description": "Domain-specific knowledge" }
  ]
}
```

---

## Phase 2: Skills System Integration

### 2.1 Detect Existing Skills

Check for existing skill/prompt systems in the project:

| Location                  | System                                    |
| ------------------------- | ----------------------------------------- |
| `.github/prompts/`        | GitHub Copilot custom instructions        |
| `.github/prompts/skills/` | GitHub Copilot with Factsets-style skills |
| `.cursor/prompts/`        | Cursor AI prompts                         |
| `.cursor/rules/`          | Cursor AI rules                           |
| `.claude/`                | Claude Desktop configuration              |
| `.windsurf/`              | Windsurf AI configuration                 |
| `/prompts/`               | Generic prompts directory                 |
| `/skills/`                | Generic skills directory                  |
| `/docs/prompts/`          | Documentation-style prompts               |
| `copilot-instructions.md` | GitHub Copilot instructions file          |
| `.cursorrules`            | Cursor rules file                         |

**Search for these locations and examine their contents.**

### 2.2 Skills Directory Decision

If an existing skills system is found:

**Option A: Existing directory matches a Factsets client**

If skills are already in `.github/prompts/skills/`, `.cursor/prompts/skills/`, or similar:

```json
{ "tool": "set_config", "key": "client", "value": "[matching-client]" }
```

Clients and their directories:

- `github-copilot` → `.github/prompts/skills/`
- `cursor` → `.cursor/prompts/skills/`
- `claude` → `.claude/skills/`
- `generic` → `.factsets/skills/`

**Option B: Custom directory location**

If existing skills are in a non-standard location (e.g., `/docs/skills/`, `/prompts/`):

**ASK THE USER**:

> I found existing skills in `[path]`. Factsets can either:
>
> 1. **Use your existing location**: Set `skills_dir` to `[path]`
> 2. **Migrate to standard location**: Move skills to `[client-path]` for better tool integration
>
> Which would you prefer?

Based on response:

```json
// Option 1: Use existing
{ "tool": "set_config", "key": "skills_dir", "value": "[existing-path]" }

// Option 2: Migrate (will move files)
{ "tool": "set_config", "key": "client", "value": "[client]" }
// Then manually move skill files to new location
```

**Option C: No existing skills**

Create the standard directory for the detected or preferred client:

```json
{ "tool": "set_config", "key": "client", "value": "github-copilot" }
```

### 2.3 Migrate Existing Skills

For each existing skill file found:

1. **Read the skill content** to understand its purpose
2. **Check if already in Factsets**: `search_skills` by name or relevant tags
3. **Create or sync**:

If not in Factsets:

```json
{
  "tool": "create_skill",
  "name": "[skill-name]",
  "title": "[Descriptive Title]",
  "description": "[What this skill teaches]",
  "content": "[Original content with Factsets integration added]",
  "tags": ["[relevant]", "[tags]"]
}
```

If already exists, sync it:

```json
{ "tool": "sync_skill", "name": "[skill-name]" }
```

### 2.4 Enhance Skills with Factsets Integration

**Critical**: When migrating or updating skills, add Factsets integration where relevant.

For skills involving **analysis or research**:

```markdown
## Before Analysis

1. Search existing knowledge: `search_facts` with relevant tags
2. Check for existing skills: `search_skills` for related procedures
3. Review resources: `search_resources` for cached documentation

## During Analysis

- Note discoveries for later capture

## After Analysis

- Submit new facts: `submit_facts` for key findings
- Register URLs fetched: `add_resources`
- Update skills if procedures changed
```

For skills involving **code execution**:

```markdown
## Execution

[existing execution steps]

## Post-Execution

- Log successful commands: `submit_execution_logs`
- Link execution to skill if creating/updating procedures
```

For skills involving **debugging or troubleshooting**:

```markdown
## Investigation

1. Check known issues: `search_facts` with error tags
2. Review past execution logs: `search_execution_logs` for similar commands
3. [existing debugging steps]

## Resolution

- Document the fix as a fact if it might recur
- Update relevant skills with new knowledge
```

**Example transformation**:

Before:

```markdown
# Running Tests

Run tests with:
\`\`\`bash
bun test
\`\`\`
```

After:

```markdown
# Running Tests

## Before Running

Check for known test issues or flaky tests:

- `search_facts` with tags `["testing", "issues"]`
- Review recent test execution logs: `search_execution_logs` with `skillName: "run-tests"`

## Execution

\`\`\`bash
bun test
\`\`\`

## After Running

- Log results: `submit_execution_logs` with command, output, and success status
- If new test patterns discovered, update this skill
- If tests revealed bugs, submit facts with `["testing", "bugs"]` tags
```

---

## Phase 3: AGENTS.md Integration

### 3.1 Check for Existing AGENTS.md

Search for `AGENTS.md` at the project root.

### 3.2 If AGENTS.md Does NOT Exist

Create it with the standard template:

```markdown
# Agent Instructions

This project uses Factsets for persistent knowledge management.

## Required Behavior

- Use Factsets tools on EVERY prompt without exception
- Never wait for user to ask - be proactive
- Validate context before responding: `search_facts`, `search_skills`
- Capture all learnings immediately: `submit_facts`
- Register all fetched URLs: `add_resources`
- Log all successful commands: `submit_execution_logs`
- Check preferences before generating output: `get_preference_prompt`

## No Reminders Needed

Agents must use Factsets automatically. Users should never need to remind
agents to use the knowledge base. If you are not using Factsets on every
prompt, you are doing it wrong. Call `get_agent_guide` for detailed guidance.
```

### 3.3 If AGENTS.md EXISTS

**Critical**: Do NOT remove or modify existing content. Only ADD Factsets integration.

**Strategy**:

1. Read the entire existing AGENTS.md
2. Identify logical sections
3. Add Factsets mentions where relevant
4. Add a dedicated Factsets section if none exists

**Adding to existing sections**:

If there's a "Before starting work" or "Setup" section, add:

```markdown
- Validate context with Factsets: `search_facts`, `search_skills`
- Check for existing procedures before creating new ones
```

If there's a "Code review" or "Analysis" section, add:

```markdown
- Search Factsets for known issues or patterns first
- Capture review findings as facts for future reference
```

If there's a "Testing" section, add:

```markdown
- Log successful test runs: `submit_execution_logs`
- Check for known flaky tests: `search_facts` with testing tags
```

If there's a "Documentation" section, add:

```markdown
- Register documentation URLs as resources
- Update facts when documentation changes
```

**Adding the Factsets section**:

If no Factsets section exists, add one (do not remove other sections):

```markdown
## Factsets Knowledge Management

This project uses Factsets for persistent knowledge management.

### On Every Prompt

1. Validate context: `search_facts`, `search_skills` for relevant knowledge
2. Capture learnings: `submit_facts` for new discoveries
3. Register URLs: `add_resources` for any fetched content
4. Log commands: `submit_execution_logs` for successful executions

### Key Behaviors

- Use Factsets proactively without being asked
- Capture knowledge immediately, not at session end
- Check existing skills before creating new procedures
- Update facts when information changes

### Getting Started

Call `get_agent_guide` for comprehensive Factsets workflow documentation.
```

**Placement**: Add the Factsets section:

- After any existing "Required Behavior" or "Guidelines" section
- Before any project-specific technical details
- As the last major section if no clear insertion point

---

## Phase 4: Configuration Optimization

### 4.1 Analyze Project Characteristics

Based on your analysis, determine appropriate configuration:

| Project Type         | Recommended Settings                     |
| -------------------- | ---------------------------------------- |
| Active development   | Lower `freshness_source_code` (6-8h)     |
| Stable/mature        | Higher thresholds across the board       |
| Documentation-heavy  | Lower `freshness_documentation` (24-48h) |
| Frequent deployments | Lower `freshness_infrastructure` (12h)   |
| API development      | Lower `freshness_api_schemas` (12h)      |

### 4.2 Set Configuration

If the project has specific needs, propose configuration changes to the user:

> Based on my analysis, I recommend these configuration adjustments:
>
> - `freshness_source_code`: 8 (active development)
> - `freshness_documentation`: 48 (docs update with code)
>
> Would you like me to apply these?

Only set configuration with user approval:

```json
{ "tool": "set_config", "key": "freshness_source_code", "value": "8" }
```

### 4.3 Tag Relationships (Optional)

If the project has synonymous or hierarchical concepts, configure tag relationships:

```json
// Synonyms
{ "tool": "set_config", "key": "tag_synonyms", "value": "{\"js\": \"javascript\", \"ts\": \"typescript\"}" }

// Hierarchies
{ "tool": "set_config", "key": "tag_hierarchies", "value": "{\"backend\": [\"api\", \"database\", \"auth\"]}" }
```

---

## Phase 5: Initial Skill Creation

### 5.1 Essential Project Skills

Create skills for common project tasks if they don't exist:

**Project Overview Skill**:

```json
{
  "tool": "create_skill",
  "name": "project-overview",
  "title": "Project Overview",
  "description": "High-level understanding of the project architecture and purpose",
  "content": "# [Project Name] Overview\n\n## Purpose\n[What the project does]\n\n## Architecture\n[Key components]\n\n## Tech Stack\n- [Languages/frameworks]\n- [Key dependencies]\n\n## Getting Started\n1. [Setup steps]\n\n## Key Entry Points\n- [Main files/modules]",
  "tags": ["project", "overview", "getting-started"]
}
```

**Development Workflow Skill**:

```json
{
  "tool": "create_skill",
  "name": "development-workflow",
  "title": "Development Workflow",
  "description": "Standard development process for this project",
  "content": "# Development Workflow\n\n## Before Starting\n\n1. Check Factsets for context: `search_facts`, `search_skills`\n2. Review recent execution logs for similar work\n\n## Development\n\n[Project-specific development steps]\n\n## After Changes\n\n1. Run tests: [test command]\n2. Log results: `submit_execution_logs`\n3. Update facts if architecture changed\n4. Update skills if procedures changed",
  "tags": ["project", "development", "workflow"]
}
```

### 5.2 Validate Skill Creation

After creating skills, verify they were created correctly:

```json
{ "tool": "search_skills", "tags": ["project"] }
```

---

## Phase 6: Verification

### 6.1 Verify Integration

Confirm all components are properly integrated:

1. **Skills directory exists** and contains skills
2. **AGENTS.md exists** with Factsets instructions
3. **Facts are populated** with project knowledge
4. **Resources are registered** for key files
5. **Configuration is set** appropriately

### 6.2 Test the Integration

Run a quick validation:

```json
{ "tool": "search_facts", "tags": ["project"] }
{ "tool": "search_skills", "tags": ["project"] }
{ "tool": "search_resources", "tags": ["project"] }
{ "tool": "list_config" }
```

All should return relevant results.

### 6.3 Create Integration Fact

Record that setup was completed:

```json
{
  "tool": "submit_facts",
  "facts": [
    {
      "content": "Factsets integration completed on [date]. Skills in [path], AGENTS.md updated.",
      "tags": ["project", "factsets", "setup"],
      "sourceType": "code",
      "verified": true
    }
  ]
}
```

---

## Summary Report

After completing setup, provide a summary to the user:

```
## Factsets Integration Complete

### What Was Done

- [x] Analyzed project structure and established baseline facts
- [x] [Created/Configured] skills directory at `[path]`
- [x] [Created/Updated] AGENTS.md with Factsets instructions
- [x] Migrated [N] existing skills with Factsets integration
- [x] Registered [N] key resources
- [x] Created [N] initial project facts
- [x] Set configuration for [project characteristics]

### Skills Directory

Location: `[skills-path]`
Skills: [list of skill names]

### Next Steps

1. Review created skills and customize for your workflow
2. Add domain-specific facts as you work
3. Create additional skills for common procedures
4. Factsets will now work automatically on every prompt

### Commands Reference

- View knowledge: `search_facts`, `search_skills`, `search_resources`
- Add knowledge: `submit_facts`, `create_skill`, `add_resources`
- Configuration: `list_config`, `set_config`, `get_config_schema`
- Guidance: `get_agent_guide`, `get_concept_guide`
```

---

## Edge Cases

### Multiple AI Tool Configurations

If the project has configurations for multiple AI tools (e.g., both `.github/prompts/` and `.cursor/`):

**ASK THE USER**:

> I found configurations for multiple AI tools: [list]. Which should be the primary location for Factsets skills? (Skills can be symlinked to other locations if needed.)

### Conflicting Skill Names

If migrating skills and a name collision is detected:

- Check if content is identical (can skip migration)
- If different, use `update_skill` to merge content
- Preserve all unique content from both sources

### Very Large Existing Skills

If existing skills are very large (>10KB):

- Consider splitting into multiple focused skills
- Link related skills using `link_skill`
- Ask user for guidance on organization

### No Clear Project Structure

If the project structure is unclear:

1. Ask the user about the project's purpose
2. Ask about key files and entry points
3. Use their answers to establish initial facts
4. Create a project-overview skill documenting what was learned

---

## Anti-Patterns to Avoid

| Don't                             | Do                                      |
| --------------------------------- | --------------------------------------- |
| Remove existing AGENTS.md content | Add sections alongside existing content |
| Move skills without asking        | Confirm directory changes with user     |
| Skip reading existing skills      | Read and understand before migrating    |
| Create duplicate facts            | Search first, then submit               |
| Set configuration silently        | Explain and get user approval           |
| Rush through analysis             | Thorough setup saves future tokens      |
| Assume project structure          | Verify through file examination         |
| Forget to log setup commands      | Use `submit_execution_logs`             |

---

## Completion Criteria

Setup is complete when:

1. All Factsets guides have been read and understood
2. Project structure has been analyzed and documented as facts
3. Skills directory is configured and contains skills
4. AGENTS.md exists with Factsets instructions
5. Key configuration files are registered as resources
6. User has been informed of what was done and next steps

**Remember**: The goal is to set up future agents for success. Every fact, skill, and resource created now saves discovery time on every future prompt.
