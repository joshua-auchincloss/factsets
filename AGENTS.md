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

## Pre-Response Checklist

Before responding to any user prompt:

1. Did I `search_facts` for relevant domain knowledge?
2. Did I `search_skills` if this involves a procedure?
3. Am I about to claim something I should verify first?
4. Will my response involve code? Check `get_preference_prompt`
5. Am I learning something new? Prepare to `submit_facts`

## Prompt Classification

| Prompt Type            | Primary Tools                            | Search Strategy                |
| ---------------------- | ---------------------------------------- | ------------------------------ |
| Question about project | `search_facts`                           | Tags from question + "project" |
| Debug/fix request      | `search_facts` + `search_execution_logs` | Error keywords, component tags |
| "How do I..."          | `search_skills`                          | Task-related tags              |
| Code generation        | `search_facts` + `get_preference_prompt` | Domain tags + code style       |
| Research request       | `search_resources`                       | Domain tags                    |

## Tag Strategy

1. Extract nouns from prompt: "Fix the database migration" -> database, migration
2. Add context: What component? What domain? -> drizzle, schema
3. Include action type: fix -> bugs, debugging, issues
4. Use hierarchy: If unsure, use broader parent tag

## During Long Tasks

For multi-step work, use Factsets between steps - do not wait until completion:

- After each successful command: `submit_execution_logs`
- After discovering something: `submit_facts`
- After fetching external content: `add_resources`

Context windows grow large and knowledge gets lost if you wait.

## Automatic Capture Triggers

| Event                            | Action                       |
| -------------------------------- | ---------------------------- |
| You learn something              | `submit_facts` immediately   |
| You fetch a URL                  | `add_resources` with the URL |
| A command succeeds               | `submit_execution_logs`      |
| You write a multi-step procedure | `create_skill`               |
| User corrects your output        | `infer_preference`           |

## What to Capture

- **Fact**: Atomic truth, 1-3 sentences, no procedure
- **Skill**: Multi-step procedure, reusable workflow
- **Resource**: External content that may change

## What NOT to Capture

- Obvious from code (IDE can tell you)
- User's immediate request context (ephemeral)
- Debugging output (unless pattern emerges)

## Self-Check Before Ending Task

1. Did I learn something new? -> `submit_facts`
2. Did I fetch external content? -> `add_resources`
3. Did I run commands that worked? -> `submit_execution_logs`
4. Did I discover a reusable procedure? -> `create_skill`
5. Did user express a style preference? -> `infer_preference`

## No Reminders Needed

Agents must use Factsets automatically. Users should never need to remind
agents to use the knowledge base. If you are not using Factsets on every
prompt, you are doing it wrong. Call `get_agent_guide` for detailed guidance.
