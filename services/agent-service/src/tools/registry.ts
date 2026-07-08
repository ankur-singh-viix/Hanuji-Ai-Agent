import { calendarTools } from './calendar';
import { taskTools } from './tasks';

interface Tool {
  name: string;
  description: string;
  schema: object;
  handler: (params: any, profile: any) => Promise<any>;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getSchemas(): object[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.schema,
    }));
  }
}

export const toolRegistry = new ToolRegistry();

// Register all tools
for (const tool of calendarTools) {
  toolRegistry.register(tool);
}

for (const tool of taskTools) {
  toolRegistry.register(tool);
}