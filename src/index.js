#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { MemoryClient } from "./MemoryClient.js";

const SERVICE_NAME = "pytest-mcp";
const SERVICE_VERSION = "0.1.0";
const DEBUG = process.env.DEBUG === "true";

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: SERVICE_NAME,
    message,
    ...data,
  };
  console[level](JSON.stringify(logEntry));
}

function debug(message, data = {}) {
  if (DEBUG) {
    log("debug", message, data);
  }
}

function info(message, data = {}) {
  log("info", message, data);
}

import fs from "fs";
import path from "path";

function ensureLogsDirectory() {
  const logsDir = path.join(path.dirname(new URL(import.meta.url).pathname), "../logs");
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

function error(message, data = {}) {
  
  // Debug log to verify error function is called
  debug("Error function called", { message, data });
  
  // Ensure logs directory exists
  const logsDir = ensureLogsDirectory();
  
  // Create log entry
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: "error",
    service: SERVICE_NAME,
    message,
    ...data,
  };
  
  // Write to error log file
  const logFilePath = path.join(logsDir, `error-${timestamp.split("T")[0]}.log`);
  fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + "\n");
  
  // Maintain existing console logging
  log("error", message, data);
}

const isValidRecordSessionStartArgs = (args) =>
  typeof args === "object" &&
  args !== null &&
  typeof args.environment === "object" &&
  args.environment !== null &&
  typeof args.environment.os === "string" &&
  typeof args.environment.python_version === "string";

const isValidRecordTestOutcomeArgs = (args) =>
  typeof args === "object" &&
  args !== null &&
  typeof args.nodeid === "string" &&
  typeof args.outcome === "string" &&
  typeof args.duration === "number" &&
  (args.error === undefined || typeof args.error === "string");

const isValidRecordSessionFinishArgs = (args) =>
  typeof args === "object" &&
  args !== null &&
  typeof args.summary === "object" &&
  args.summary !== null;

class PytestMcpServer {
  constructor() {
    this.memoryClient = new MemoryClient(this);
    this.server = new Server(
      {
        name: SERVICE_NAME,
        version: SERVICE_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          requestHandlers: {
            handleRequest: true
          }
        }
      }
    );

    this.setupToolHandlers();

    // Enhanced error handling
    this.server.onerror = (error) => {
      log("error", "MCP Error", {
        error: error.message,
        code: error.code,
        stack: error.stack,
      });
      if (error.code === ErrorCode.MethodNotFound) {
        log("error", "Available methods", {
          methods: [
            "record_session_start",
            "record_test_outcome",
            "record_session_finish",
          ],
        });
      }
    };

    process.on("SIGINT", async () => {
      info("Received SIGINT, closing server");
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      debug("Handling ListTools request", { requestId: request.id });
      const tools = [
        {
          name: "record_session_start",
          description: "Record the start of a test session.",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "object",
                properties: {
                  os: {
                    type: "string",
                  },
                  python_version: {
                    type: "string",
                  },
                },
                required: ["os", "python_version"],
              },
            },
            required: ["environment"],
          },
        },
        {
          name: "record_test_outcome",
          description: "Record the outcome of a test.",
          inputSchema: {
            type: "object",
            properties: {
              nodeid: {
                type: "string",
              },
              outcome: {
                type: "string",
              },
              duration: {
                type: "number",
              },
              error: {
                type: "string",
              },
            },
            required: ["nodeid", "outcome", "duration"],
          },
        },
        {
          name: "record_session_finish",
          description: "Record the completion of a test session.",
          inputSchema: {
            type: "object",
            properties: {
              summary: {
                type: "object",
              },
            },
            required: ["summary"],
          },
        },
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "record_session_start":
            return await this.handleRecordSessionStart(args);
          case "record_test_outcome":
            return await this.handleRecordTestOutcome(args);
          case "record_session_finish":
            return await this.handleRecordSessionFinish(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Method not found: ${name}`
            );
        }
      } catch (e) {
        error(`Error handling ${name}`, {
          requestId: request.id,
          arguments: args,
          error: e.message,
          stack: e.stack,
        });
        throw new McpError(ErrorCode.InternalError, `Error: ${e.message}`);
      }
    });
  }

  async handleRequest(type, params) {
    try {
      debug("Handling request", { type, params });
      const response = await this.server.handleRequest(type, params);
      debug("Request handled successfully", { type, response });
      return response;
    } catch (error) {
      error("Error handling request", { type, params, error });
      throw error;
    }
  }

  async handleRecordSessionStart(args) {
    if (!isValidRecordSessionStartArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for record_session_start"
      );
    }

    const { environment } = args;

    // Clear previous data
    await this.memoryClient.deleteEntities(["TestRun_Latest"]);
    await this.memoryClient.deleteRelations([
      {
        from: "TestRun_Latest",
        to: "*",
        relationType: "*",
      },
      {
        from: "*",
        to: "TestRun_Latest",
        relationType: "*",
      },
    ]);

    // Create Env_Current entity
    await this.memoryClient.createEntities([
      {
        name: "Env_Current",
        entityType: "TestEnvironment",
        observations: [
          `OS: ${environment.os}`,
          `Python Version: ${environment.python_version}`,
        ],
      },
    ]);

    // Create TestRun_Latest entity
    await this.memoryClient.createEntities([
      {
        name: "TestRun_Latest",
        entityType: "TestRun",
        observations: ["status: running"],
      },
    ]);

    // Create ran_on relation
    await this.memoryClient.createRelations([
      {
        from: "TestRun_Latest",
        to: "Env_Current",
        relationType: "ran_on",
      },
    ]);

    debug("Successfully recorded session start", { environment });

    return {
      content: [
        {
          type: "text",
          text: `Test session started with environment: ${JSON.stringify(
            environment
          )}`,
        },
      ],
    };
  }

  async handleRecordTestOutcome(args) {
    if (!isValidRecordTestOutcomeArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for record_test_outcome"
      );
    }

    const { nodeid, outcome, duration, error: error_message } = args;
    const [test_suite, test_name] = nodeid.split("::");

    // Create/update pytest entity
    await this.memoryClient.createEntities([
      {
        name: "pytest",
        entityType: "TestingFramework",
        observations: [
          "Python testing framework",
          "Version: 7.4.0",
          "Supports unit testing and functional testing"
        ],
      },
    ]);

    // Create test result entity with detailed observations
    await this.memoryClient.createEntities([
      {
        name: nodeid,
        entityType: "TestResult",
        observations: [
          `outcome: ${outcome}`,
          `duration: ${duration}s`,
          `timestamp: ${new Date().toISOString()}`,
          ...(error_message ? [`error: ${error_message}`] : []),
        ],
      },
    ]);

    // Create test suite entity if it doesn't exist
    await this.memoryClient.createEntities([
      {
        name: test_suite,
        entityType: "TestSuite",
        observations: [],
      },
    ]);

    // Create relations
    await this.memoryClient.createRelations([
      {
        from: nodeid,
        to: "pytest",
        relationType: "is_part_of",
      },
      {
        from: nodeid,
        to: test_suite,
        relationType: "is_part_of",
      },
      {
        from: "TestRun_Latest",
        to: nodeid,
        relationType: "contains_test",
      },
    ]);

    debug("Successfully recorded test outcome", {
      nodeid,
      outcome,
      duration,
      error: error_message,
    });

    return {
      content: [
        {
          type: "text",
          text: `Test outcome recorded for ${nodeid}: ${outcome} (${duration}s)${
            error_message ? ` with error: ${error_message}` : ""
          }`,
        },
      ],
    };
  }

  async handleRecordSessionFinish(args) {
    if (!isValidRecordSessionFinishArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for record_session_finish"
      );
    }

    const { summary } = args;

    // Update TestRun_Latest status
    await this.memoryClient.addObservations([
      {
        entityName: "TestRun_Latest",
        contents: ["status: finished"],
      },
    ]);

    // Add summary observations
    await this.memoryClient.addObservations([
      {
        entityName: "TestRun_Latest",
        contents: [
          `total_tests: ${summary.total_tests}`,
          `passed: ${summary.passed}`,
          `failed: ${summary.failed}`,
          `skipped: ${summary.skipped}`,
          `exitstatus: ${summary.exitstatus}`,
          `end_time: ${new Date().toISOString()}`,
        ],
      },
    ]);

    debug("Successfully recorded session finish", { summary });

    return {
      content: [
        {
          type: "text",
          text: `Test session finished with summary: ${JSON.stringify(
            summary
          )}`,
        },
      ],
    };
  }

  async run() {
    console.log(
      `[${SERVICE_NAME}] Starting ${SERVICE_NAME} (version ${SERVICE_VERSION}).`
    );
    console.log(`[${SERVICE_NAME}] Node.js version: ${process.version}`);
    console.log(`[${SERVICE_NAME}] Process platform: ${process.platform}`);

    const transport = new StdioServerTransport();
    console.log(`[${SERVICE_NAME}] Initializing stdio transport...`);
    try {
      await this.server.connect(transport);
      console.log(`[${SERVICE_NAME}] MCP server connected via stdio.`);
      console.log(`[${SERVICE_NAME}] Server ready to accept requests.`);
    } catch (error) {
      console.error(
        `[${SERVICE_NAME}] [Error] Failed to connect via stdio:`,
        error
      );
      process.exit(1);
    }
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  error("Uncaught Exception", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  error("Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

const server = new PytestMcpServer();
server.run().catch((error) => {
  error("Uncaught Error in Server Run", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
