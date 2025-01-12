# mcp_pytest_service

This README provides an overview of the `mcp_pytest_service`, including its purpose, dependencies, build process, and how to run it. It is based on patterns observed in the `memory` MCP server.

## Project Overview

The `mcp_pytest_service` is an MCP (Model Context Protocol) server that integrates with pytest to provide context and memory capabilities for test runs. It allows capturing and storing information about test sessions, environments, and individual test outcomes.

## Dependencies

The `mcp_pytest_service` has the following dependencies:

-   **MCP SDK (`@modelcontextprotocol/sdk`)**: This is the core dependency for building MCP servers. It provides the necessary classes and interfaces for creating servers, defining tools, and handling requests. The `mcp_pytest_service` uses the `Server` class and `StdioServerTransport` from the SDK for communication.
-   **Node.js**: The service is built using Node.js and requires a compatible version to be installed.
-   **TypeScript**: The service is written in TypeScript and requires the TypeScript compiler (`tsc`) for building.
-   **pytest** (for testing): The service integrates with pytest and requires it for running tests.

## Building

The build process for `mcp_pytest_service` involves compiling the TypeScript code and making the output executable. The following steps are typically involved:

1. **Compile TypeScript:**
    
    -   The TypeScript compiler (`tsc`) is used to compile the TypeScript source code into JavaScript.
    -   The `tsconfig.json` file configures the compilation process, including strict type checking, ES module support, and source map generation.
    -   The compiled JavaScript files are output to the `build` directory.
2. **Make Executable:**
    
    -   The main entry point file (e.g., `build/index.js`) is made executable using `chmod`. This allows the server to be run directly using `node build/index.js`.
3. **Package (Optional):**
    
    -   The service can be packaged for distribution using a package manager like npm. This typically involves creating a `package.json` file with the necessary metadata, dependencies, and scripts.

## Running

The `mcp_pytest_service` can be run in different ways depending on its implementation and how it's packaged. Here's a guide on when to use `uvx`, `npx`, or `node`:

**1. Running MCP Servers with `uvx` (Python-based):**

-   Use `uvx` to run MCP servers that are:
    -   Installed as **pip packages** (Python packages)
    -   Implemented as **local Python source files**
-   `uvx` is a tool specifically designed for managing and running MCP servers implemented in Python.
-   Install `uvx` globally using npm (it's distributed as an npm package for convenience):

    ```bash
    npm install -g uvx
    ```

-   Example for running an MCP server implemented as a local Python package with `uvx`:

    ```bash
    uvx mcp-server-git --repository /Users/kieranlal/workspace/mcp_pytest_service
    ```

    This command starts the `mcp-server-git` tool, which is configured to run an MCP service from the specified repository.

**2. Running MCP Servers with `npx` (JavaScript-based, npm packages):**

-   Use `npx` to run MCP servers that are:
    -   Implemented in **JavaScript**
    -   Published as **npm packages**
-   `npx` is a tool for running npm packages without needing to install them globally.

-   Example:

    ```bash
    npx @modelcontextprotocol/mcp-server-example
    ```

**3. Running MCP Servers with `node` (JavaScript-based, local source):**

-   Use `node` to run MCP servers that are:
    -   Implemented in **JavaScript**
    -   Have **local JavaScript source files**
-   This is typically used during development or when the server is not packaged as an npm package.

-   Example:

    ```bash
    node path/to/your/mcp_server.js
    ```

**In the specific case of `mcp_pytest_service`:**

-   Since it's being developed locally and uses `mcp-server-git` (which is Python-based), you would typically use `uvx` as shown in the example above.
-   If it were a JavaScript-based server published as an npm package, you would use `npx`.
-   If it were a JavaScript-based server with local source files, you would use `node`.
-   When running with npm exec, ensure the source file is executable by running:
    ```bash
    chmod +x src/index.js
    ```

## Tool Definitions

MCP servers define tools that can be called by clients. Tools are defined using JSON Schema to specify their input and output structures. The `mcp_pytest_service` defines the following tools:

1. **`record_session_start`**: Called at the beginning of a pytest session to initialize the context for the current test run.
    
    -   Input:
        
        ```json
        {
          "environment": {
            "os": "string",
            "python_version": "string"
          }
        }
        
        ```
        
2. **`record_test_outcome`**: Called after each individual test case to record its outcome.
    
    -   Input:
        
        ```json
        {
          "nodeid": "string",
          "outcome": "string (passed|failed|skipped)",
          "duration": "number",
          "error": "string (optional)"
        }
        
        ```
        
3. **`record_session_finish`**: Called at the end of a pytest session to record summary information.
    
    -   Input:
        
        ```json
        {
          "summary": {
            "total_tests": "integer",
            "passed": "integer",
            "failed": "integer",
            "skipped": "integer",
            "exitstatus": "integer"
          }
        }
        
        ```
        

These tools are exposed through the `server.setRequestHandler()` API, as seen in the `memory` server implementation.

## Memory Server Example

The `memory` MCP server provides a good example of how to build and run MCP servers. Its `package.json` and `tsconfig.json` files demonstrate the following patterns:

-   Using the `Server` class and `StdioServerTransport` from the MCP SDK.
-   Defining project metadata, dependencies, and scripts in `package.json`.
-   Configuring TypeScript with strict type checking and ES module support in `tsconfig.json`.
-   Defining tool interfaces and input schemas using JSON Schema.
-   Exposing tools through the `server.setRequestHandler()` API.

These patterns can be used as a reference for building and running the `mcp_pytest_service`.

## Implementation Status

The `mcp_pytest_service` is designed to integrate with the **TypeScript** version of the MCP SDK, not the Python SDK. It depends on the **MCP memory service** to store and retrieve information about test runs. Before running this service, ensure that the memory service is installed and running in the environment.

The implementation of this service is similar to other MCP services like `memory`, `github`, `git`, and `fileserver`, all of which are typically run using `npx` when they are published as npm packages in the development environment.

The source code for these packages is available as a reference for using the MCP SDK:

-   `memory`: Implements a basic in-memory knowledge graph. (npm package: `@modelcontextprotocol/server-memory`)
-   `github`: Provides tools for interacting with the GitHub API. (npm package: `@modelcontextprotocol/server-github`)
-   `git`: Offers Git repository management capabilities. (Uses the `mcp-server-git` tool, with multiple instances in the configuration: `git-textgrad`, `git-mcp_pytest_service`, `git-ixl_scraper`, `git-mcp-installer`)
-   `fileserver`: Enables file system operations. (npm package: `@modelcontextprotocol/server-filesystem`)

By examining the source code of these services, you can gain a better understanding of how to structure and implement your own MCP servers using the TypeScript SDK.

## Available Tools

In addition to the tools defined in this service, the following MCP servers are also available:

- `@modelcontextprotocol/server-memory`: Provides a basic in-memory knowledge graph.
- `@modelcontextprotocol/server-github`: Offers tools for interacting with the GitHub API.
- `mcp-server-git`: Enables Git repository management capabilities.
- `@modelcontextprotocol/server-filesystem`: Allows file system operations.
- `@modelcontextprotocol/server-sequential-thinking`: Newly installed server for sequential thinking capabilities.

These servers can be used in conjunction with `mcp_pytest_service` to enhance its functionality and provide additional context for test runs.

## Logging Configuration

The service is configured with the following logging setup:

- Logs are stored in the `logs/` directory
- Each log file is named with a timestamp in the format: YYYY-MM-DDTHH_MM_SS_SSSZ-debug-0.log
- Logs include detailed information about:
  - Server startup and initialization
  - Tool execution and results
  - Error conditions and stack traces
  - Memory operations and state changes
- Logs are rotated automatically, keeping a maximum of 10 files

## Pytest Integration

The `mcp_pytest_service` integrates with pytest through a `conftest.py` file that defines pytest hooks. When you run pytest in a directory containing tests and the `conftest.py` file:

1. pytest automatically discovers and uses the `conftest.py` file
2. The following hooks are triggered automatically:
   - `pytest_sessionstart` at the beginning of the test session
   - `pytest_runtest_makereport` after each test completes
   - `pytest_sessionfinish` at the end of the test session
3. These hooks call the corresponding MCP service tools:
   - `record_session_start` at session start
   - `record_test_outcome` after each test
   - `record_session_finish` at session end
4. The service communicates with the `server-memory` MCP server to store test data

You do not need to manually run `conftest.py` - simply running `pytest` in the directory is sufficient to trigger the integration and update the memory with test results.
