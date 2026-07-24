---
name: prompt-perfector
description: Refine, structure, and optimize user prompts for LLMs while ensuring execution occurs in a isolated environment. Use when asked to polish, perfect, or evaluate prompts safely.
---

# Prompt Perfector

Refines user prompts into structured, highly effective instructions and executes evaluation tasks in an isolated workspace (`Workspace: "branch"`).

## Core Capabilities

1. **Prompt Refinement**: Analyzes input prompts for clarity, context, constraints, output format specifications, and edge cases.
2. **Environment Isolation**: Ensures any code execution, prompt testing, or subagent tasks spawned for prompt validation run within an isolated workspace (`Workspace: "branch"` or `"share"`).

## Workflow

1. **Deconstruct Intent**: Identify the goal, target model, domain constraints, and missing specifications.
2. **Enhance Structure**: Apply structured formatting (System Instructions, Context, Input Schema, Output Constraints, Examples).
3. **Isolated Testing**: If prompt validation requires subagent execution or file testing, invoke subagents with `Workspace: "branch"`.
4. **Deliver Output**: Present the perfected prompt with a summary of structural enhancements and usage recommendations.
