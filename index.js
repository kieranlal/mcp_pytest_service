#!/usr/bin/env node
import { 
  Server, 
  StdioServerTransport, 
  CallToolRequestSchema, 
  ErrorCode, 
  ListToolsRequestSchema, 
  McpError, 
  MemoryClient 
} from '@modelcontextprotocol/sdk/dist/index.js';

const SERVICE_NAME = 'pytest-mcp';
const SERVICE_VERSION = '0.1.0';

const isValidRecordSessionStartArgs = (
  args
) =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.environment === 'object' &&
  args.environment !== null &&
  typeof args.environment.os === 'string' &&
  typeof args.environment.python_version === 'string';

const isValidRecordTestOutcomeArgs = (
  args
) =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.nodeid === 'string' &&
  typeof args.outcome === 'string' &&
  typeof args.duration === 'number' &&
  (args.error === undefined || typeof args.error === 'string');

const isValidRecordSessionFinishArgs = (
  args
) =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.summary === 'object' &&
  args.summary !== null;

class PytestMcpServer {
  constructor() {
    this.memoryClient = new MemoryClient();
    this.server = new Server(
      {
        name: SERVICE_NAME,
        version: SERVICE_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Enhanced error handling
    this.server.onerror = (error) => {
      console.error(`[${SERVICE_NAME}] [MCP Error]`, error);
      if (error.code === ErrorCode.MethodNotFound) {
        console.error(`[${SERVICE_NAME}] Available methods:`, [
          'record_session_start',
          'record_test_outcome',
          'record_session_finish'
        ]);
      }
    };
    
    process.on('SIGINT', async () => {
      console.log(`[${SERVICE_NAME}] Received SIGINT, closing server...`);
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      console.log(`[${SERVICE_NAME}] Handling ListTools request.`);
      const tools = [
        {
          name: 'record_session_start',
          description: 'Record the start of a test session.',
          inputSchema: {
            type: 'object',
            properties: {
              environment: {
                type: 'object',
                properties: {
                  os: {
                    type: 'string',
                  },
                  python_version: {
                    type: 'string',
                  },
                },
                required: ['os', 'python_version'],
              },
            },
            required: ['environment'],
          },
        },
        {
          name: 'record_test_outcome',
          description: 'Record the outcome of a test.',
          inputSchema: {
            type: 'object',
            properties: {
              nodeid: {
                type: 'string',
              },
              outcome: {
                type: 'string',
              },
              duration: {
                type: 'number',
              },
              error: {
                type: 'string',
              },
            },
            required: ['nodeid', 'outcome', 'duration'],
          },
        },
        {
          name: 'record_session_finish',
          description: 'Record the completion of a test session.',
          inputSchema: {
            type: 'object',
            properties: {
              summary: {
                type: 'object',
              },
            },
            required: ['summary'],
          },
        },
      ];
      
      // Register each tool explicitly
      tools.forEach(tool => {
        this.server.registerTool(tool.name, tool);
      });
      
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'record_session_start') {
        if (!isValidRecordSessionStartArgs(request.params.arguments)) {
          const errorMessage = 'Invalid arguments for record_session_start';
          console.error(`[${SERVICE_NAME}] [Error] ${errorMessage}`, request.params.arguments);
          throw new McpError(
            ErrorCode.InvalidParams,
            errorMessage
          );
        }
        const sessionId = `session_${Date.now()}`;
        await this.memoryClient.create_entities({
          entities: [{
            name: sessionId,
            entityType: 'test_session',
            observations: [
              `Environment: ${JSON.stringify(request.params.arguments.environment)}`,
              `Start time: ${new Date().toISOString()}`
            ]
          }]
        });

        return {
          content: [
            {
              type: 'text',
              text: `Test session started with environment: ${JSON.stringify(
                request.params.arguments.environment
              )}`,
            },
          ],
        };
      } else if (request.params.name === 'record_test_outcome') {
        if (!isValidRecordTestOutcomeArgs(request.params.arguments)) {
          const errorMessage = 'Invalid arguments for record_test_outcome';
          console.error(`[${SERVICE_NAME}] [Error] ${errorMessage}`, request.params.arguments);
          throw new McpError(
            ErrorCode.InvalidParams,
            errorMessage
          );
        }
        return {
          content: [
            {
              type: 'text',
              text: `Test outcome recorded: ${JSON.stringify(
                request.params.arguments
              )}`,
            },
          ],
        };
      } else if (request.params.name === 'record_session_finish') {
        if (!isValidRecordSessionFinishArgs(request.params.arguments)) {
          const errorMessage = 'Invalid arguments for record_session_finish';
          console.error(`[${SERVICE_NAME}] [Error] ${errorMessage}`, request.params.arguments);
          throw new McpError(
            ErrorCode.InvalidParams,
            errorMessage
          );
        }
        return {
          content: [
            {
              type: 'text',
              text: `Test session finished with summary: ${JSON.stringify(
                request.params.arguments.summary
              )}`,
            },
          ],
        };
      } else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Method not found: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    console.log(`[${SERVICE_NAME}] Starting ${SERVICE_NAME} (version ${SERVICE_VERSION}).`);
    console.log(`[${SERVICE_NAME}] Node.js version: ${process.version}`);
    console.log(`[${SERVICE_NAME}] Process platform: ${process.platform}`);

    const transport = new StdioServerTransport();
    console.log(`[${SERVICE_NAME}] Initializing stdio transport...`);
    try {
      await this.server.connect(transport);
      console.log(`[${SERVICE_NAME}] MCP server connected via stdio.`);
      console.log(`[${SERVICE_NAME}] Server ready to accept requests.`);
    } catch (error) {
      console.error(`[${SERVICE_NAME}] [Error] Failed to connect via stdio:`, error);
      process.exit(1);
    }
  }
}

const server = new PytestMcpServer();
server.run().catch(error => console.error(`[${SERVICE_NAME}] [Uncaught Error]`, error));
