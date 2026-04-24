import type { PromptInput } from '../../shared/types'

export const SEED_PROMPTS: PromptInput[] = [
  {
    title: 'LangChain: Structured output extraction',
    description:
      'Extract typed fields from unstructured text using a pydantic schema.',
    content: `You are an information extraction engine. Given the text below, extract the fields defined in the schema. Respond ONLY with valid JSON matching the schema. If a field is missing, use null.

Schema:
{schema}

Text:
"""
{input_text}
"""`,
    category: 'LangChain',
    modelTarget: 'Claude',
    tags: ['extraction', 'structured-output'],
    isFavorite: true
  },
  {
    title: 'LangGraph: Supervisor routing prompt',
    description:
      'Route user requests to specialist agents in a supervisor-worker LangGraph.',
    content: `You are the SUPERVISOR of a multi-agent system. Given the user request, decide which worker to invoke next, or respond FINISH when the task is complete.

Available workers: {workers}
Conversation so far: {history}
User request: {request}

Respond with a single JSON object: {"next": "<worker_name | FINISH>", "reason": "<one sentence>"}`,
    category: 'LangGraph',
    modelTarget: 'GPT-4',
    tags: ['routing', 'supervisor', 'multi-agent']
  },
  {
    title: 'RAG: Grounded answer with citations',
    description:
      'Answer from retrieved context only, with inline [n] citations.',
    content: `Answer the QUESTION using ONLY the information in CONTEXT. For every factual claim, cite the source chunk inline using [1], [2], etc. If the context does not contain the answer, say "I don't know based on the provided context."

CONTEXT:
{context}

QUESTION:
{question}`,
    category: 'RAG',
    modelTarget: 'Any',
    tags: ['citations', 'grounding', 'retrieval']
  },
  {
    title: 'System Design: API contract review',
    description: 'Review a proposed REST/GraphQL contract for common issues.',
    content: `You are a principal engineer reviewing an API contract. Evaluate the following spec for:
- Resource modeling and naming
- Pagination, filtering, sorting
- Error shapes and status codes
- Versioning and backward compatibility
- Authn/authz boundaries
- Rate limiting and idempotency

Spec:
"""
{spec}
"""

Respond with a bulleted critique grouped by the categories above, then a short "Risks" section and a "Recommended changes" list ordered by impact.`,
    category: 'System Design',
    modelTarget: 'Claude',
    tags: ['api', 'review', 'architecture']
  },
  {
    title: 'Agents: Tool-use reflection',
    description: 'Reflect on the last tool call and decide next action.',
    content: `You are an autonomous agent. Review the last tool invocation and its result, then decide the next step.

Goal: {goal}
Last tool: {tool_name}
Arguments: {tool_args}
Observation: {observation}

Return JSON: {"thought": "...", "next_action": {"type": "tool|answer|stop", "tool": "...", "args": {...}, "answer": "..."}}`,
    category: 'Agents',
    modelTarget: 'GPT-4',
    tags: ['react', 'reflection', 'tool-use']
  }
]
