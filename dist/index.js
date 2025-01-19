#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { MemoryClient } from "./MemoryClient.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from 'node:url';
// Import the new schemas
export const ServiceStatusRequestSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
};
export const ServiceStatusResponseSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        version: { type: "string" },
        command: { type: "string", nullable: true },
        args: { type: "array", items: { type: "string" }, nullable: true },
    },
    required: ["name", "version"],
    additionalProperties: false,
};
const SERVICE_NAME = "pytest-mcp";
const SERVICE_VERSION = "0.2.0"; // Incrementing version due to changes
const DEBUG = process.env.DEBUG === "true";
const LOGS_DIRECTORY = path.join(fileURLToPath(new URL('.', import.meta.url)), '../logs');
const PYTEST_VERSION = process.env.PYTEST_VERSION || "unknown"; // Make pytest version configurable
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
async function ensureLogsDirectory() {
    try {
        await fs.mkdir(LOGS_DIRECTORY, { recursive: true });
    }
    catch (error) {
        console.error(`Error creating logs directory: ${error}`);
    }
}
async function error(message, data = {}) {
    debug("Error function called", { message, data });
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level: "error",
        service: SERVICE_NAME,
        message,
        ...data,
    };
    const logFileName = `error-${new Date().toISOString().split("T")[0]}.log`;
    const logFilePath = path.join(LOGS_DIRECTORY, logFileName);
    try {
        await fs.appendFile(logFilePath, JSON.stringify(logEntry) + "\n");
    }
    catch (err) {
        console.error(`Error writing to log file ${logFilePath}: ${err}`);
    }
    log("error", message, data);
}
const isValidRecordSessionStartArgs = (args) => typeof args === "object" &&
    args !== null &&
    typeof args.environment === "object" &&
    args.environment !== null &&
    typeof args.environment.os === "string" &&
    typeof args.environment.python_version === "string";
const isValidRecordTestOutcomeArgs = (args) => typeof args === "object" &&
    args !== null &&
    typeof args.nodeid === "string" &&
    typeof args.outcome === "string" &&
    typeof args.duration === "number" &&
    (args.error === undefined || typeof args.error === "string");
const isValidRecordSessionFinishArgs = (args) => typeof args === "object" &&
    args !== null &&
    typeof args.summary === "object" &&
    args.summary !== null;
class PytestMcpServer {
    constructor() {
        this.memoryClient = new MemoryClient(this);
        this.server = new Server({
            name: SERVICE_NAME,
            version: SERVICE_VERSION,
        }, {
            capabilities: {
                tools: {},
                resources: {},
                requestHandlers: {
                    handleRequest: true
                }
            }
        });
        this.setupToolHandlers();
        this.setupErrorHandling();
    }
    setupErrorHandling() {
        this.server.onerror = (err) => {
            log("error", "MCP Error", {
                error: err.message,
                code: err.code,
                stack: err.stack,
            });
            if (err.code === ErrorCode.MethodNotFound) {
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
            await this.close();
            process.exit(0);
        });
        process.on("uncaughtException", (error) => {
            error("Uncaught Exception", {
                message: error.message,
                stack: error.stack,
            });
            process.exit(1);
        });
        process.on("unhandledRejection", (reason, promise) => {
            error("Unhandled Rejection", {
                reason: reason instanceof Error ? reason.message : reason,
                stack: reason instanceof Error ? reason.stack : undefined,
            });
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
                {
                    name: "service_status",
                    description: "Get the status and configuration of the service.",
                    inputSchema: ServiceStatusRequestSchema,
                    outputSchema: ServiceStatusResponseSchema,
                },
            ];
            return { tools };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case "record_session_start":
                        return await this.#handleRecordSessionStart(args);
                    case "record_test_outcome":
                        return await this.#handleRecordTestOutcome(args);
                    case "record_session_finish":
                        return await this.#handleRecordSessionFinish(args);
                    case "service_status":
                        return await this.#handleServiceStatus();
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Method not found: ${name}`);
                }
            }
            catch (e) {
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
    async #handleServiceStatus() {
        const status = {
            name: SERVICE_NAME,
            version: SERVICE_VERSION,
            command: process.argv[0],
            args: process.argv.slice(1),
        };
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(status, null, 2)
                }
            ]
        };
    }
    // Removed the general handleRequest method as it was redundant
    async #handleRecordSessionStart(args) {
        if (!isValidRecordSessionStartArgs(args)) {
            throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for record_session_start");
        }
        const { environment } = args;
        // Clear previous data
        await this.memoryClient.deleteEntities(["TestRun_Latest"]);
        await this.memoryClient.deleteRelations([
            { from: "TestRun_Latest", to: "*", relationType: "*" },
            { from: "*", to: "TestRun_Latest", relationType: "*" },
        ]);
        // Create Env_Current entity
        await this.#createEntity("Env_Current", "TestEnvironment", [
            `OS: ${environment.os}`,
            `Python Version: ${environment.python_version}`,
        ]);
        // Create TestRun_Latest entity
        await this.#createEntity("TestRun_Latest", "TestRun", ["status: running"]);
        // Create ran_on relation
        await this.#createRelation("TestRun_Latest", "Env_Current", "ran_on");
        debug("Successfully recorded session start", { environment });
        return {
            content: [
                {
                    type: "text",
                    text: `Test session started with environment: ${JSON.stringify(environment)}`,
                },
            ],
        };
    }
    async #handleRecordTestOutcome(args) {
        if (!isValidRecordTestOutcomeArgs(args)) {
            throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for record_test_outcome");
        }
        const { nodeid, outcome, duration, error: error_message } = args;
        const [test_suite, test_name] = nodeid.split("::");
        // Create/update pytest entity
        await this.#createEntity("pytest", "TestingFramework", [
            "Python testing framework",
            `Version: ${PYTEST_VERSION}`, // Using configurable pytest version
            "Supports unit testing and functional testing",
        ]);
        // Create test result entity with detailed observations
        await this.#createEntity(nodeid, "TestResult", [
            `outcome: ${outcome}`,
            `duration: ${duration}s`,
            `timestamp: ${new Date().toISOString()}`,
            ...(error_message ? [`error: ${error_message}`] : []),
        ]);
        // Create test suite entity if it doesn't exist
        await this.#createEntity(test_suite, "TestSuite", []);
        // Create relations
        await this.#createRelation(nodeid, "pytest", "is_part_of");
        await this.#createRelation(nodeid, test_suite, "is_part_of");
        await this.#createRelation("TestRun_Latest", nodeid, "contains_test");
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
                    text: `Test outcome recorded for ${nodeid}: ${outcome} (${duration}s)${error_message ? ` with error: ${error_message}` : ""}`,
                },
            ],
        };
    }
    async #handleRecordSessionFinish(args) {
        if (!isValidRecordSessionFinishArgs(args)) {
            throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for record_session_finish");
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
                    text: `Test session finished with summary: ${JSON.stringify(summary)}`,
                },
            ],
        };
    }
    // Helper function to create an entity
    async #createEntity(name, entityType, observations = []) {
        await this.memoryClient.createEntities([
            { name, entityType, observations },
        ]);
    }
    // Helper function to create a relation
    async #createRelation(from, to, relationType) {
        await this.memoryClient.createRelations([{ from, to, relationType }]);
    }
    async run() {
        console.log(`[${SERVICE_NAME}] Starting ${SERVICE_NAME} (version ${SERVICE_VERSION}).`);
        console.log(`[${SERVICE_NAME}] Node.js version: ${process.version}`);
        console.log(`[${SERVICE_NAME}] Process platform: ${process.platform}`);
        await ensureLogsDirectory(); // Ensure logs directory exists on startup
        const transport = new StdioServerTransport();
        console.log(`[${SERVICE_NAME}] Initializing stdio transport...`);
        try {
            await this.server.connect(transport);
            console.log(`[${SERVICE_NAME}] MCP server connected via stdio.`);
            console.log(`[${SERVICE_NAME}] Server ready to accept requests.`);
        }
        catch (error) {
            console.error(`[${SERVICE_NAME}] [Error] Failed to connect via stdio:`, error);
            process.exit(2); // Use a specific exit code for connection failure
        }
    }
    async close() {
        try {
            await this.server.close();
            info("MCP server closed successfully.");
        }
        catch (error) {
            error("Error closing MCP server", {
                message: error.message,
                stack: error.stack,
            });
            process.exit(1);
        }
    }
}
const server = new PytestMcpServer();
server.run().catch((error) => {
    error("Uncaught Error in Server Run", {
        message: error.message,
        stack: error.stack,
    });
    process.exit(1);
});
