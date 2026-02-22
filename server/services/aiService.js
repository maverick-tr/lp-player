import { readSettings } from './settingsService.js';

const SYSTEM_PROMPT = `You are an expert software installation assistant for the LP Player (Local App Manager).
Your job is to analyze a project's README.md and generate a precise, executable installation plan.

You MUST respond with valid JSON matching this exact schema:
{
  "projectName": "string - human-readable name for the project",
  "description": "string - one sentence description",
  "language": "python|node|rust|go|mixed|other",
  "packageManager": "pip|uv|npm|yarn|pnpm|cargo|go|make|other",
  "port": "string - the port number the app runs on, or empty string if none",
  "category": "string - one of: application, developer-agents, media, audio, AI, or a new fitting category",
  "tags": ["array", "of", "relevant", "tags"],
  "steps": [
    {
      "label": "string - human readable step description",
      "command": "string - exact shell command to run",
      "workingDir": ".",
      "critical": true
    }
  ],
  "runCommand": "string - the command to start/run the application",
  "activationCommand": "string - environment activation command (e.g. 'source .venv/bin/activate'), or empty string",
  "questions": [
    {
      "question": "string - question to ask the user if something is ambiguous",
      "options": ["option1", "option2"],
      "default": "option1"
    }
  ]
}

IMPORTANT RULES:
1. For Python projects: ALWAYS include a step to create a virtual environment using \`python3 -m venv .venv\` as the FIRST step, even if the README does not mention it.
2. For Python projects: Use \`uv pip install\` instead of \`pip install\` when instructed to prefer uv. If the project uses requirements.txt, use \`uv pip install -r requirements.txt\`. If it uses pyproject.toml, use \`uv pip install .\` or \`uv pip install -e .\`.
3. The activation command for Python venvs should be \`source .venv/bin/activate\`.
12. Do NOT include any step to install uv itself (e.g. \`pip install uv\`, \`curl ... uv\`). uv is already available system-wide if the user has it — never install it into a venv.
13. Do NOT use \`uv venv\` or \`uv init\` to create virtual environments. ALWAYS use \`python3 -m venv .venv\`. The \`uv\` tool should ONLY be used as \`uv pip install\` for package installation.
4. Extract the port number from the README. Look for --port flags, PORT environment variables, or default port mentions.
5. Do NOT include dangerous commands (rm -rf /, sudo without specific reason, etc.).
6. Do NOT include git clone -- the repository is already cloned.
7. Include .env setup steps if the README mentions environment variables (copy .env.example to .env).
8. Each command must be a single shell command (use && to chain if needed within one step).
9. The runCommand should be the command to START the application (not install it).
10. If the README is unclear or ambiguous about critical setup steps, add a question to the questions array.
11. Respond with ONLY the JSON object, no markdown fences or extra text.`;

// Detect API provider from URL
function detectProvider(apiUrl) {
  const url = apiUrl.toLowerCase();
  if (url.includes('anthropic.com') || url.includes('claude')) return 'anthropic';
  if (url.includes('openai.com')) return 'openai';
  // Default: OpenAI-compatible (works for DeepSeek, local AI, Groq, Together, etc.)
  return 'openai-compatible';
}

// Check if model is a reasoning/thinking model that needs special handling
function isReasoningModel(model) {
  return /reason|think|r1|o[1-4](-|$)|o3|ora-/i.test(model);
}

// Check if model is an OpenAI o-series reasoning model
function isOpenAIReasoningModel(model) {
  return /^o[1-4](-|$)|^o3/i.test(model);
}

// --- Anthropic (Claude) Messages API ---
async function callAnthropic(apiUrl, apiKey, model, systemPrompt, userPrompt) {
  const url = `${apiUrl.replace(/\/+$/, '')}/v1/messages`;

  const isThinking = isReasoningModel(model);

  const body = {
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ],
  };

  // Claude extended thinking uses budget_tokens, non-thinking uses temperature
  if (!isThinking) {
    body.temperature = 0.1;
  }

  console.log(`[AI] Calling Anthropic API: ${url}, model: ${model}, thinking: ${isThinking}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${text}`);
  }

  const data = await response.json();

  // Claude returns content as an array of blocks: [{type: "thinking", ...}, {type: "text", text: "..."}]
  let content = '';
  if (Array.isArray(data.content)) {
    // Get the last text block (skip thinking blocks)
    for (const block of data.content) {
      if (block.type === 'text') {
        content = block.text;
      }
    }
  }

  if (!content) {
    console.error('Anthropic response structure:', JSON.stringify(data, null, 2).slice(0, 500));
    throw new Error('Anthropic API returned empty response');
  }

  return content;
}

// --- OpenAI-compatible Chat Completions API ---
async function callOpenAICompatible(apiUrl, apiKey, model, systemPrompt, userPrompt) {
  const url = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const isReasoning = isReasoningModel(model);
  const isOSeries = isOpenAIReasoningModel(model);

  // OpenAI o-series models use 'developer' role instead of 'system', and don't support temperature
  const messages = isOSeries
    ? [
        { role: 'developer', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

  const body = {
    model,
    messages,
    // Skip temperature for o-series reasoning models (not supported)
    ...(isOSeries ? {} : { temperature: 0.1 }),
    // Skip json_object format for reasoning/thinking models — they need to emit thinking tokens first
    ...(isReasoning ? {} : { response_format: { type: 'json_object' } })
  };

  console.log(`[AI] Calling OpenAI-compatible API: ${url}, model: ${model}, reasoning: ${isReasoning}, o-series: ${isOSeries}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;

  // Some reasoning models put the answer in reasoning_content
  if (!content && data.choices?.[0]?.message?.reasoning_content) {
    content = data.choices[0].message.reasoning_content;
  }

  if (!content) {
    console.error('AI response structure:', JSON.stringify(data.choices?.[0]?.message || data, null, 2).slice(0, 500));
    throw new Error('AI returned empty response');
  }

  return content;
}

// --- Extract JSON from AI response content ---
function extractJSON(content) {
  console.log(`[AI] Raw content length: ${content.length}, has <think>: ${content.includes('<think>')}`);

  // Strip <think>...</think> blocks from thinking/reasoning models
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Also handle unclosed <think> tags (model still thinking when output started)
  content = content.replace(/<think>[\s\S]*/gi, '').trim();

  if (!content) {
    throw new Error('AI returned only thinking content, no JSON plan');
  }

  console.log(`[AI] After stripping think tags: ${content.slice(0, 200)}...`);

  try {
    const parsed = JSON.parse(content);
    console.log(`[AI] Parsed plan — steps: ${parsed.steps?.length ?? 'undefined'}, project: ${parsed.projectName}`);
    return parsed;
  } catch (e) {
    // Try to extract JSON from markdown fences
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    // Try to find a JSON object in the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`AI returned invalid JSON: ${content.slice(0, 200)}`);
  }
}

export async function analyzeReadme(readmeContent, existingTools, options = {}) {
  const settings = readSettings();
  const { apiUrl, apiKey, model } = settings.ai;
  const { preferUv, alwaysCreatePythonVenv } = settings.installation;
  const globalEnvVars = settings.environment?.globalVariables || {};

  if (!apiUrl || !model) {
    throw new Error('AI not configured. Go to Settings to set API URL and model.');
  }

  const toolsList = existingTools.map(t => ({
    name: t.name,
    port: t.port || 'none'
  }));

  const userPrompt = `Analyze this README.md and generate an installation plan.

EXISTING TOOLS AND THEIR PORTS (for conflict detection):
${JSON.stringify(toolsList, null, 2)}

TARGET INSTALLATION PATH: ${options.targetPath || 'not specified'}

PREFERENCES:
- Prefer uv for Python package management: ${preferUv ? 'YES' : 'NO'}
- Always create Python venv: ${alwaysCreatePythonVenv ? 'YES' : 'NO'}

ALREADY CONFIGURED GLOBAL ENVIRONMENT VARIABLES (these are automatically injected at launch time — do NOT create steps to export these):
${Object.keys(globalEnvVars).length > 0
  ? Object.entries(globalEnvVars).map(([k, v]) => `- ${k}=${v.length > 8 ? v.slice(0, 4) + '••••' + v.slice(-4) : '••••'}`).join('\n')
  : '(none configured)'}
NOTE: If the README requires environment variables that are ALREADY listed above, skip those setup steps — they are handled. Only include steps for variables NOT already configured.

${options.previousInstallContext || ''}
README.md CONTENT:
---
${readmeContent}
---

Generate the installation plan as JSON. Check if the project's port conflicts with any existing tool ports listed above.`;

  const provider = detectProvider(apiUrl);
  console.log(`[AI] Detected provider: ${provider} (url: ${apiUrl}, model: ${model})`);

  let content;
  if (provider === 'anthropic') {
    content = await callAnthropic(apiUrl, apiKey, model, SYSTEM_PROMPT, userPrompt);
  } else {
    content = await callOpenAICompatible(apiUrl, apiKey, model, SYSTEM_PROMPT, userPrompt);
  }

  return extractJSON(content);
}
