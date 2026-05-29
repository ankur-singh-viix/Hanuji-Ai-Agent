import axios from "axios";
import { DateTime } from "luxon";
import { logger } from "./lib/logger";
import { toolRegistry } from "./tools/registry";
import { db } from "./lib/db";

/* ─────────────────────────────────────────────
   LOCAL MODEL CALL
───────────────────────────────────────────── */
async function callLocalModel(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  try {
    const fullPrompt = `
${systemPrompt}

User:
${userPrompt}

Assistant:
Respond ONLY with valid JSON.
`;

    const response = await axios.post(
      "http://127.0.0.1:11434/api/generate",
      {
        model: "mistral:7b-instruct-q4_0",
        prompt: fullPrompt,
        stream: false,
        options: {
          num_predict: 120,
          temperature: 0.7,
        },
      },
      { timeout: 120000 }
    );

    return response.data.response;
  } catch (error: any) {
    logger.error("Ollama error", { error: error.message });
    return JSON.stringify({
      intent: "error",
      reply: "⚠️ Local model error. Make sure Ollama is running.",
      tool_call: { name: null, params: {} },
      needs_confirmation: false,
      confidence: 0,
    });
  }
}

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */

interface ProcessInput {
  userId: string;
  channel: string;
  message: string;
  context: {
    recentHistory: any[];
    longTermFacts: string[];
    userProfile: any;
  };
}

interface AgentResult {
  reply: string;
  intent: string;
  toolUsed?: string;
  toolResult?: any;
  needsConfirmation?: boolean;
  confirmationData?: any;
}

/* ─────────────────────────────────────────────
   AGENT CORE
───────────────────────────────────────────── */

export class AgentCore {
  private buildSystemPrompt(profile: any): string {
    const now = DateTime.now().setZone(
      profile?.timezone || "Asia/Kolkata"
    );

    return `
You are Hanu Ji, a personal AI assistant.

User: ${profile?.name || "the user"}
Current time: ${now.toFormat(
      "cccc, MMMM d yyyy, h:mm a"
    )} (${profile?.timezone || "Asia/Kolkata"})
Work hours: ${profile?.work_start || "09:00"} - ${
      profile?.work_end || "18:00"
    }

PERSONALITY:
Friendly, efficient, proactive.
Support Hinglish naturally if user uses it.

IMPORTANT:
Respond ONLY in valid JSON.
Do NOT include explanations outside JSON.

JSON format:
{
  "intent": "create_event|fetch_events|delete_event|send_email|fetch_emails|general|clarify|error",
  "reply": "Natural language response",
  "tool_call": { "name": "string|null", "params": {} },
  "needs_confirmation": false,
  "confidence": 0.95
}

RULES:
1. Resolve relative times correctly.
2. For destructive actions -> needs_confirmation = true.
3. Never invent event IDs.
4. If unclear -> intent = "clarify".
5. Always return valid JSON.
`;
  }

  async process(input: ProcessInput): Promise<AgentResult> {
    const { userId, channel, message, context } = input;
    const { recentHistory, longTermFacts, userProfile } = context;

    const systemPrompt = this.buildSystemPrompt(userProfile);

    const historyText = recentHistory
      .slice(-4)
      .map((turn) => `${turn.role}: ${turn.content}`)
      .join("\n");

    const memoryText =
      longTermFacts.length > 0
        ? `User Memory:\n${longTermFacts.join("\n")}\n`
        : "";

    const finalUserPrompt = `
${memoryText}
Recent Conversation:
${historyText}

User says:
${message}
`;

    let llmResponse = await callLocalModel(
      systemPrompt,
      finalUserPrompt
    );

    let parsed: any;

    try {
      const cleaned = llmResponse
        .replace(/```json|```/g, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      return { reply: llmResponse, intent: "general" };
    }

    /* ───────── TOOL EXECUTION ───────── */

    if (parsed.tool_call?.name && !parsed.needs_confirmation) {
      const toolResult = await this.executeTool(
        parsed.tool_call.name,
        parsed.tool_call.params,
        userProfile
      );

      if (toolResult.success) {
        const formattedReply = await this.formatToolResult(
          message,
          parsed.tool_call.name,
          toolResult.data,
          userProfile
        );

        await this.logConversation(
          userId,
          channel,
          message,
          formattedReply,
          parsed.intent,
          parsed.tool_call.name,
          toolResult
        );

        return {
          reply: formattedReply,
          intent: parsed.intent,
          toolUsed: parsed.tool_call.name,
          toolResult: toolResult.data,
        };
      }

      const errorReply = `I had trouble with that: ${toolResult.error}. Please try again.`;

      await this.logConversation(
        userId,
        channel,
        message,
        errorReply,
        "error",
        parsed.tool_call.name,
        toolResult
      );

      return {
        reply: errorReply,
        intent: "error",
        toolUsed: parsed.tool_call.name,
      };
    }

    /* ───────── CONFIRMATION FLOW ───────── */

    if (parsed.needs_confirmation && parsed.tool_call?.name) {
      await this.logConversation(
        userId,
        channel,
        message,
        parsed.reply,
        parsed.intent,
        null,
        null
      );

      return {
        reply: parsed.reply,
        intent: parsed.intent,
        needsConfirmation: true,
        confirmationData: parsed.tool_call,
      };
    }

    /* ───────── GENERAL REPLY ───────── */

    await this.logConversation(
      userId,
      channel,
      message,
      parsed.reply,
      parsed.intent,
      null,
      null
    );

    return { reply: parsed.reply, intent: parsed.intent };
  }

  private async executeTool(
    name: string,
    params: any,
    userProfile: any
  ) {
    const tool = toolRegistry.get(name);
    if (!tool)
      return { success: false, error: `Unknown tool: ${name}` };

    try {
      logger.info(`Executing tool: ${name}`, { params });
      const data = await tool.handler(params, userProfile);
      return { success: true, data };
    } catch (err: any) {
      logger.error(`Tool ${name} failed`, {
        err: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  private async formatToolResult(
    originalMessage: string,
    toolName: string,
    result: any,
    profile: any
  ): Promise<string> {
    const systemPrompt = `
You are Hanu Ji.
Format tool results as friendly, concise replies (1-3 sentences).
Current time: ${DateTime.now()
      .setZone(profile?.timezone || "Asia/Kolkata")
      .toFormat("h:mm a")}
`;

    const userPrompt = `
User asked: "${originalMessage}"
Tool "${toolName}" returned:
${JSON.stringify(result)}

Write a helpful reply.
`;

    return await callLocalModel(systemPrompt, userPrompt);
  }

  private async logConversation(
    userId: string,
    channel: string,
    userMsg: string,
    assistantMsg: string,
    intent: string | null,
    toolUsed: string | null,
    toolResult: any
  ) {
    try {
      await db.query(
        `INSERT INTO conversation_logs 
         (user_id, channel, role, content, intent, tool_used, tool_result)
         VALUES ($1,$2,'user',$3,$4,$5,$6)`,
        [
          userId,
          channel,
          userMsg,
          intent,
          toolUsed,
          JSON.stringify(toolResult),
        ]
      );

      await db.query(
        `INSERT INTO conversation_logs 
         (user_id, channel, role, content, intent, tool_used)
         VALUES ($1,$2,'assistant',$3,$4,$5)`,
        [userId, channel, assistantMsg, intent, toolUsed]
      );
    } catch (err: any) {
      logger.error("Failed to log conversation", {
        err: err.message,
      });
    }
  }
}