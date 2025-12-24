---
name: swe-bench-evaluation
title: "Agent Benchmarking Guide"
description: "Comprehensive guide for benchmarking AI agents including MCP-Bench for MCP server evaluation, SWE-bench for coding tasks, BFCL for function calling, and τ-bench for tool-agent interactions."
tags:
  [
    "benchmarking",
    "evaluation",
    "mcp-bench",
    "swe-bench",
    "bfcl",
    "tau-bench",
    "mini-swe-agent",
    "tutorial",
    "best-practices",
  ]
updated: 2025-12-22
---

# Agent Benchmarking Guide

## Overview

This guide covers the major benchmarks for evaluating AI agents and LLM tool-use capabilities:

| Benchmark      | Focus                        | Best For                      |
| -------------- | ---------------------------- | ----------------------------- |
| **MCP-Bench**  | MCP server tool usage        | Evaluating MCP-integrated agents |
| **SWE-bench**  | Real GitHub issue resolution | Coding agent accuracy         |
| **BFCL**       | Function/tool calling        | Tool selection & parameters   |
| **τ-bench**    | Tool-Agent-User interaction  | Multi-turn dialogues          |

---

# MCP-Bench Evaluation

## Overview

**MCP-Bench** (Accenture) is the definitive benchmark for evaluating LLM agents using Model Context Protocol servers. Accepted to NeurIPS 2025 Workshop.

- **Paper**: [arxiv.org/abs/2508.20453](https://arxiv.org/abs/2508.20453)
- **Leaderboard**: [huggingface.co/spaces/mcpbench/mcp-bench](https://huggingface.co/spaces/mcpbench/mcp-bench)
- **GitHub**: [github.com/accenture/mcp-bench](https://github.com/accenture/mcp-bench)

### Evaluation Dimensions

1. **Schema Understanding** (rule-based) - Tool discovery and schema parsing
2. **Task Completion** (LLM-judged with o4-mini) - End-to-end task success
3. **Tool Usage Accuracy** - Correct tool selection and parameters
4. **Planning Effectiveness** - Multi-step reasoning quality

### Server Configurations

- **Single-server**: 28 individual MCP servers
- **Multi-server (2)**: Two-server coordination tasks
- **Multi-server (3)**: Three-server complex scenarios

## Setup

```bash
# Clone and setup
git clone https://github.com/accenture/mcp-bench.git
cd mcp-bench

# Create environment
conda create -n mcpbench python=3.10
conda activate mcpbench

# Install MCP servers
cd mcp_servers
bash ./install.sh
cd ..

# Configure API keys
cat > .env << EOF
export OPENROUTER_API_KEY="your_key"
export AZURE_OPENAI_API_KEY="your_key"  # optional
export AZURE_OPENAI_ENDPOINT="your_endpoint"  # optional
EOF

# Configure MCP server API keys (free)
# Edit ./mcp_servers/api_key with:
# - NPS_API_KEY (nps.gov/developer)
# - NASA_API_KEY (api.nasa.gov)
# - HF_TOKEN (huggingface.co/settings/tokens)
# - GOOGLE_MAPS_API_KEY (developers.google.com/maps)
```

## Running Evaluations

```bash
# Verify MCP server connectivity (should show 28/28)
python ./utils/collect_mcp_info.py

# List available models
source .env
python run_benchmark.py --list-models

# Run full benchmark
python run_benchmark.py --models gpt-4o

# Single-server tasks only
python run_benchmark.py --models gpt-4o \
  --tasks-file tasks/mcpbench_tasks_single_runner_format.json

# Multi-server (2) tasks
python run_benchmark.py --models gpt-4o \
  --tasks-file tasks/mcpbench_tasks_multi_2server_runner_format.json

# Multi-server (3) tasks
python run_benchmark.py --models gpt-4o \
  --tasks-file tasks/mcpbench_tasks_multi_3server_runner_format.json
```

## Adding Factsets to MCP-Bench

To evaluate agents using Factsets as an MCP server:

1. Add Factsets server config to `mcp_servers/commands.json`
2. Create task files in `tasks/` targeting Factsets tools
3. Run benchmark with Factsets server enabled

## Current Leaderboard (Dec 2025)

| Model                 | Overall Score |
| --------------------- | ------------- |
| gpt-5                 | 0.749         |
| o3                    | 0.715         |
| gemini-2.5-pro        | 0.690         |
| claude-sonnet-4       | 0.681         |
| qwen3-235b-a22b-2507  | 0.678         |
| gpt-4o                | 0.595         |

---

# SWE-bench Evaluation

## Overview

SWE-bench is the gold standard benchmark for evaluating AI coding systems on real-world software engineering tasks. This guide covers the complete evaluation pipeline from dataset selection to leaderboard submission.

## Dataset Selection

Choose the appropriate subset based on your goals:

| Subset                   | Size  | Use Case                                       |
| ------------------------ | ----- | ---------------------------------------------- |
| **SWE-bench Full**       | 2,294 | Comprehensive evaluation, research papers      |
| **SWE-bench Verified**   | 500   | Production evaluation (recommended)            |
| **SWE-bench Lite**       | 300   | Development, iteration, cost-effective testing |
| **SWE-bench Multimodal** | 517   | Systems with visual understanding              |

**Recommendation**: Use `swe-bench_lite` for development, `swe-bench_verified` for production evaluation.

## Environment Setup

### 1. Install Required Tools

```bash
# SWE-bench CLI for submission
pip install sb-cli

# mini-SWE-agent for evaluation
pip install mini-swe-agent

# Optional: SWE-ReX for parallel execution
pip install swe-rex
```

### 2. Configure API Keys

```bash
# For Anthropic models
export ANTHROPIC_API_KEY=your_key

# For OpenAI models
export OPENAI_API_KEY=your_key

# Generate SWE-bench API key
sb-cli gen-api-key
```

### 3. Verify Setup

```bash
sb-cli verify-api-key
sb-cli get-quotas  # Check submission limits
```

## Running Evaluation with mini-SWE-agent

### Basic Evaluation

```bash
mini-extra swebench \
  --model anthropic/claude-sonnet-4-5-20250929 \
  --subset swe-bench_lite \
  --split dev \
  --workers 4
```

### Model Name Format

Models require provider prefix for LiteLLM routing:

- `anthropic/claude-sonnet-4-5-20250929`
- `openai/gpt-5`
- `gemini/gemini-3-pro-preview`
- `hosted_vllm/your-local-model` (for self-hosted)

### Environment Options

```bash
# Docker (recommended for isolation)
--environment-class DockerEnvironment

# Local execution (faster, less isolation)
--environment-class LocalEnvironment
```

### Output Files

- `preds.json` - Predictions for submission
- `*.traj.json` - Trajectories for leaderboard

## Submitting Results

### 1. Submit via sb-cli

```bash
sb-cli submit swe-bench_verified test \
  --predictions_path preds.json \
  --run_id my-system-v1
```

### 2. Get Results

```bash
sb-cli get-report --run_id my-system-v1
sb-cli list-runs
```

## Leaderboard Submission

### Requirements

1. **Test split results** submitted via sb-cli
2. **Fork** the [experiments repo](https://github.com/swe-bench/experiments)
3. **Directory structure**:
   ```
   evaluation/test/YYYYMMDD_system_name/
   ├── all_preds.jsonl
   ├── metadata.yaml
   ├── README.md
   ├── trajs/
   │   └── <instance_id>.md  # Per-instance reasoning traces
   └── logs/
       └── <instance_id>/
           ├── patch.diff
           ├── report.json
           └── test_output.txt
   ```

### metadata.yaml Template

```yaml
info:
  name: "Your System Name"
  site: "https://your-site.com"
  report: "https://arxiv.org/abs/your-paper"
  authors:
    - "Author Name"
tags:
  model: "claude-sonnet-4-5"
  org: "Your Organization"
  os_model: false
  os_system: false
  checked: false
system:
  attempts: 1
```

### Submission Checklist

- [ ] Results are pass@1 (single attempt per instance)
- [ ] No PASS_TO_PASS/FAIL_TO_PASS test data used
- [ ] No hints field in predictions
- [ ] No web-browsing to SWE-bench solutions
- [ ] Trajectories included for all instances
- [ ] Run verification script: `python -m analysis.get_results evaluation/test/<folder>`

### Policy Notes

- **SWE-bench Verified/Multilingual**: Academic/research submissions only (arXiv + institutional affiliation required as of Nov 2025)
- **SWE-bench Multimodal**: Open to all submissions
- **Quotas**: Test split has limited submissions (30-day refresh). Contact support@swebench.com for increases.

## Current Top Performers (Dec 2025)

| System          | SWE-bench Verified |
| --------------- | ------------------ |
| Claude 4.5 Opus | 74.4%              |
| Gemini 3 Pro    | 74.2%              |
| GPT-5.2         | 71.8%              |

## Troubleshooting

### Common Issues

1. **Quota exceeded**: Wait for 30-day refresh or contact support
2. **Invalid predictions format**: Ensure JSON has `instance_id`, `model_patch`, `model_name_or_path`
3. **Docker issues**: Use `--environment-class LocalEnvironment` for debugging

### Getting Help

- SWE-bench docs: https://www.swebench.com
- mini-SWE-agent docs: https://mini-swe-agent.com/latest/
- Email: support@swebench.com

---

# Berkeley Function Calling Leaderboard (BFCL)

## Overview

BFCL is the comprehensive benchmark for evaluating LLM function/tool calling capabilities. Useful for measuring how well agents select and invoke tools.

- **Website**: [gorilla.cs.berkeley.edu/leaderboard.html](https://gorilla.cs.berkeley.edu/leaderboard.html)
- **GitHub**: [github.com/ShishirPatil/gorilla](https://github.com/ShishirPatil/gorilla/tree/main/berkeley-function-call-leaderboard)
- **Dataset**: [HuggingFace](https://huggingface.co/datasets/gorilla-llm/Berkeley-Function-Calling-Leaderboard)

### Evaluation Categories

- **Python**: Simple, Multiple, Parallel, Parallel-Multiple functions
- **Non-Python**: REST API, SQL, Java, JavaScript
- **Special**: Function relevance detection, chatting capability

### Versions

- **BFCL V1**: Basic function calling (AST evaluation)
- **BFCL V2**: Enterprise data, live evaluation
- **BFCL V3**: Multi-turn & multi-step function calling
- **BFCL V4**: Agentic web search, memory management, format sensitivity

## Setup

```bash
# Install from PyPI
pip install bfcl-eval

# Or editable install
git clone https://github.com/ShishirPatil/gorilla.git
cd gorilla/berkeley-function-call-leaderboard
pip install -e .

# Set project root for results
export BFCL_PROJECT_ROOT=/path/to/results

# Configure API keys
cp bfcl_eval/.env.example .env
# Edit .env with your API keys
```

## Running Evaluations

```bash
# Generate responses
bfcl generate --model gpt-4o --test-category simple_python,parallel

# Evaluate responses
bfcl evaluate --model gpt-4o --test-category simple_python,parallel
```

### Evaluation Metrics

- **AST Evaluation**: Structural correctness of function calls
- **Executable Evaluation**: Actual execution and output verification

---

# τ-bench (TAU-bench)

## Overview

τ-bench evaluates Tool-Agent-User interaction in real-world domains using simulated users and domain-specific APIs.

- **Paper**: [arxiv.org/abs/2406.12045](https://arxiv.org/abs/2406.12045)
- **GitHub**: [github.com/sierra-research/tau-bench](https://github.com/sierra-research/tau-bench)
- **Extension**: [τ²-bench](https://github.com/sierra-research/tau2-bench) (telecom domain)

### Domains

- **Airline**: Flight bookings, modifications, policy compliance
- **Retail**: Order management, returns, customer service
- **Telecom** (τ²): Troubleshooting, support scenarios

## Setup

```bash
git clone https://github.com/sierra-research/tau-bench
cd tau-bench
pip install -e .

# Set API keys
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
```

## Running Evaluations

```bash
# Tool-calling strategy on retail domain
python run.py \
  --agent-strategy tool-calling \
  --env retail \
  --model gpt-4o \
  --model-provider openai \
  --user-model gpt-4o \
  --user-model-provider openai \
  --user-strategy llm \
  --max-concurrency 10

# Specific task IDs
python run.py ... --task-ids 2 4 6
```

### User Simulator Strategies

- `llm`: Standard LLM user simulation
- `react`: Chain-of-thought user responses
- `verify`: Verification step for response quality
- `reflection`: Self-improvement on responses

---

# Benchmark Comparison

| Feature                  | MCP-Bench | SWE-bench | BFCL | τ-bench |
| ------------------------ | --------- | --------- | ---- | ------- |
| **MCP Native**           | ✅        | ❌        | ❌   | ❌      |
| **Multi-server**         | ✅        | ❌        | ❌   | ❌      |
| **Real code execution**  | ✅        | ✅        | ✅   | ✅      |
| **Multi-turn dialogue**  | ❌        | ❌        | ✅*  | ✅      |
| **User simulation**      | ❌        | ❌        | ❌   | ✅      |
| **Function calling**     | ✅        | ❌        | ✅   | ✅      |
| **Production datasets**  | ✅        | ✅        | ✅   | ✅      |

*BFCL V3+ supports multi-turn

## Recommended Evaluation Strategy for Factsets

1. **Primary**: MCP-Bench - Direct MCP server evaluation
2. **Secondary**: BFCL V4 - Memory management & tool usage
3. **Optional**: τ-bench - If evaluating conversational agents
