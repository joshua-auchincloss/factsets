# Factsets Quickstart Guide

Welcome to Factsets! This guide will help you get started with building your knowledge base.

## Core Concepts

### Facts
Facts are atomic pieces of information. They should be:
- **Self-contained**: Understandable without additional context
- **Verifiable**: Can be marked as verified once confirmed
- **Tagged**: Associated with relevant tags for organization

### Tags
Tags organize your knowledge into meaningful groups. Good tag practices:
- Use descriptive names like `project-config`, `api-patterns`, `debugging`
- Create hierarchies with prefixes: `auth:jwt`, `auth:oauth`
- System tags use the `factsets:system` prefix

### Skills
Skills are markdown documents capturing procedural knowledge:
- How to perform specific tasks
- Best practices and patterns
- Workflows and processes

### Resources
Resources track external content:
- Files in your workspace
- URLs and documentation
- API endpoints
- Shell commands

## Getting Started Workflow

1. **Discover**: Use `search_facts`, `search_skills`, or `list_tags` to explore existing knowledge
2. **Retrieve**: Use `build_skill_context` or `get_skill` to get detailed information
3. **Contribute**: Add new facts with `submit_facts`, create skills with `create_skill`
4. **Maintain**: Verify facts, update stale content, sync skill files

## Agent Interaction

If you're an AI agent, call `get_agent_guide` first for comprehensive workflow instructions.

## Tips

- Start with facts for discrete information
- Graduate to skills for procedural knowledge
- Link skills to related facts, resources, and other skills
- Use tags consistently across your knowledge base
