---
name: swe-bench-evaluation
title: "SWE-bench Evaluation Guide"
description: "Complete workflow for evaluating AI coding systems on SWE-bench, including dataset selection, mini-SWE-agent setup, sb-cli submission, and leaderboard requirements."
tags: ["swe-bench", "evaluation", "mini-swe-agent", "sb-cli", "tutorial", "best-practices"]
updated: 2025-12-22
---
# SWE-bench Evaluation Guide

## Overview

SWE-bench is the gold standard benchmark for evaluating AI coding systems on real-world software engineering tasks. This guide covers the complete evaluation pipeline from dataset selection to leaderboard submission.

## Dataset Selection

Choose the appropriate subset based on your goals:

| Subset | Size | Use Case |
|--------|------|----------|
| **SWE-bench Full** | 2,294 | Comprehensive evaluation, research papers |
| **SWE-bench Verified** | 500 | Production evaluation (recommended) |
| **SWE-bench Lite** | 300 | Development, iteration, cost-effective testing |
| **SWE-bench Multimodal** | 517 | Systems with visual understanding |

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

| System | SWE-bench Verified |
|--------|-------------------|
| Claude 4.5 Opus | 74.4% |
| Gemini 3 Pro | 74.2% |
| GPT-5.2 | 71.8% |

## Troubleshooting

### Common Issues

1. **Quota exceeded**: Wait for 30-day refresh or contact support
2. **Invalid predictions format**: Ensure JSON has `instance_id`, `model_patch`, `model_name_or_path`
3. **Docker issues**: Use `--environment-class LocalEnvironment` for debugging

### Getting Help

- SWE-bench docs: https://www.swebench.com
- mini-SWE-agent docs: https://mini-swe-agent.com/latest/
- Email: support@swebench.com
