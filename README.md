# Pytest MCP Service

## Package Status
We are running the published npm package (@modelcontextprotocol/mcp-pytest-server), not locally compiled source. This is confirmed by:
- The executable path: ~/.npm/_npx/15b07286cbcc3329/node_modules/.bin/mcp-server-memory
- The package.json configuration specifying the binary should be built to dist/index.js
- The presence in the npm global cache

For reference, the Python SDK releases are available at: https://github.com/modelcontextprotocol/python-sdk/tags

## Viewing Logs
To view the server output and logs:
1. View the live terminal output where the server is running
2. Check the log file at ~/workspace/mcp-pytest-server/output.log
3. Use tail to follow the log in real-time:
   ```bash
   tail -f ~/workspace/mcp-pytest-server/output.log
   ```
4. For historical logs, use less or cat:
   ```bash
   less ~/workspace/mcp-pytest-server/output.log
   cat ~/workspace/mcp-pytest-server/output.log
   ```

## Getting Started

### Prerequisites
- Node.js v16 or higher
- Python 3.8 or higher
- npm installed
- Memory service (@modelcontextprotocol/server-memory) running (recommended to use uvx for background execution):
  1. Install uvx: `npm install -g uvx`
  2. Create uvx config (uvx.config.js):
     ```javascript
     module.exports = {
       services: {
         memory: {
           command: 'node ~/.npm/_npx/15b07286cbcc3329/node_modules/.bin/mcp-server-memory',
           autorestart: true,
           log: 'memory.log',
           env: {
             NODE_ENV: 'production'
           }
         }
       }
     }
     ```
  3. Start service: `uvx start memory`

## Installation for mcp-pytest-server development only

### Navigate to Project Directory
```bash
cd ~/workspace/mcp-pytest-server
```

### Install JavaScript Dependencies
```bash
npm install @modelcontextprotocol/sdk
npm install
```

### Start MCP Pytest Server
```bash
node index.js
```

### Run Pytest with MCP Integration
```bash
pytest --mcp
```

## Inspecting Services

### Inspecting the Memory Service
To inspect the memory service:

1. Start the service in debug mode:
   ```bash
   npx --node-options='--inspect' @modelcontextprotocol/server-memory
   ```

2. Open Chrome DevTools at chrome://inspect

3. Click "Open dedicated DevTools for Node"

4. Set breakpoints and inspect the service's execution

Alternatively, use VSCode's built-in Node.js debugging:
1. Create a launch.json configuration:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Memory Service",
  "runtimeExecutable": "npx",
  "runtimeArgs": ["@modelcontextprotocol/server-memory"],
  "args": [],
  "console": "integratedTerminal"
}
```

### Inspecting the MCP-Pytest Service during development
To inspect the mcp-pytest service:

1. Start the service in debug mode:
   ```bash
   node --inspect ~/workspace/mcp-pytest-server/index.js
   ```

2. Open Chrome DevTools at chrome://inspect

3. Click "Open dedicated DevTools for Node"

4. Set breakpoints and inspect the service's execution

Alternatively, use VSCode's built-in Node.js debugging:
1. Create a launch.json configuration:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug MCP-Pytest Service",
  "program": "${workspaceFolder}/index.js",
  "console": "integratedTerminal"
}
```

## Architecture and Implementation

## Overview
The MCP pytest integration consists of multiple components:
1. **mcp-pytest-server**: A Node.js server that implements the MCP service tools
2. **conftest.py**: Test configuration that integrates pytest with the MCP service
3. **SDKs**: Both JavaScript and Python SDKs for MCP integration

## Component Details

### mcp-pytest-server (JavaScript)
- Location: ~/workspace/mcp-pytest-server
- Implementation: Node.js (index.js)
- Status: Running the published npm package (not locally compiled)
- Package Status: Published as '@modelcontextprotocol/mcp-pytest-server' on npm
- Executable Path: ~/.npm/_npx/15b07286cbcc3329/node_modules/.bin/mcp-server-memory (confirms published package usage)
- Functionality: Provides MCP service tools for pytest integration

### conftest.py (Python)
- Location: ~/workspace/textgrad/tests/conftest.py
- Purpose: Configures pytest to integrate with MCP services
- Current State: Successfully using Python SDK from ~/workspace/mcp-pytest-server/python-sdk

### SDKs
#### JavaScript SDK
- Location: https://github.com/modelcontextprotocol/typescript-sdk
- Package Status: Published as '@modelcontextprotocol/sdk' on npm
- Usage: Can be installed via npm install @modelcontextprotocol/sdk
- Implementation: Provides TypeScript/JavaScript client for MCP integration

#### Python SDK
- Location: ~/workspace/mcp-pytest-server/python-sdk
- Package Status: Not published on any package manager (PyPI, Conda, etc.)
- Usage: Used internally by pytest integration
- Implementation: Provides Python client for MCP integration
- Installation for Multiple Projects:
  1. Navigate to the package directory: cd ~/workspace/mcp-pytest-server/python-sdk
  2. Install in development mode: pip install -e .
  3. The package will now be available to all Python projects on the system
  4. To update, simply pull the latest changes from the repository

## Implementation Status
The core functionality for all three tools (record_session_start, record_test_outcome, record_session_finish) has been implemented in index.js. The implementation includes:

**Implementation Status:** The core functionality for all three tools (record_session_start, record_test_outcome, record_session_finish) has been implemented in index.js. The implementation includes:
- Input validation for all tools
- Proper error handling and logging
- Tool registration and request handling
- Basic response generation

## 1. `record_session_start` [IMPLEMENTED]

**Description:**
This tool is called at the beginning of a pytest session. It initializes the context for the current test run by creating or updating the "TestRun_Latest" and "Env_Current" entities in the `memory` MCP server. Importantly, this tool also ensures that any data from previous test runs associated with "TestRun_Latest" is cleared to maintain a single source of truth for the last run.

**Implementation Details:**
- Input validation for environment.os and environment.python_version
- Basic response generation with environment details
- Error handling for invalid parameters

**Input Schema:**
```json
{
  "environment": {
    "os": "string",
    "python_version": "string"
  }
}

**Example Usage:**
```
mcp call pytest-mcp record_session_start '{"environment": {"os": "Macos", "python_version": "3.13.1"}}' 
```

Expected Behavior:

Clear Previous Data: Deletes the "TestRun_Latest" entity and any relations where "TestRun_Latest" is the from or to entity from the memory MCP server. This ensures no accumulation of historical data.
Create "Env_Current" Entity: Creates an entity named "Env_Current" with the entity type "TestEnvironment" and observations for the operating system and Python version.
Create "TestRun_Latest" Entity: Creates an entity named "TestRun_Latest" with the entity type "TestRun" and an initial observation like "status: running".
Create Relation: Creates a relation of type "ran_on" from "TestRun_Latest" to "Env_Current".
Example Interaction (run in cline window):
```
use_mcp_tool pytest-mcp record_session_start '{"environment": {"os": "Macos", "python_version": "3.13.1"}}'
```

## 2. record_test_outcome [IMPLEMENTED]
Description:
This tool is called after each individual test case has finished executing. It records the outcome of the test (passed, failed, skipped), its duration, and any error information if the test failed.

**Implementation Details:**
- Input validation for nodeid, outcome, duration, and optional error
- Basic response generation with test outcome details
- Error handling for invalid parameters

Input Schema:
```
{
  "nodeid": "string",
  "outcome": "string (passed|failed|skipped)",
  "duration": "number",
  "error": "string (optional)"
}
```

Expected Behavior:

Create/Update TestCase Entity: Creates or updates an entity with the name matching the nodeid (e.g., "test_module.py::test_function"), setting its entity type to "TestCase".
Add Outcome Observation: Adds an observation with the format "outcome: <outcome>" to the TestCase entity.
Add Duration Observation: Adds an observation with the format "duration: <duration>" to the TestCase entity.
Add Error Observation (if applicable): If the outcome is "failed" and the error field is provided, add an observation with the format "error: <error>" to the TestCase entity.
Create Relation: Creates a relation of type "contains_test" from "TestRun_Latest" to the TestCase entity.
Example Interaction (run in cline window):
```
use_mcp_tool pytest-mcp record_test_outcome '{"nodeid": "test_module.py::test_example", "outcome": "passed", "duration": 0.123}'
use_mcp_tool pytest-mcp record_test_outcome '{"nodeid": "test_module.py::test_failure", "outcome": "failed", "duration": 0.05, "error": "AssertionError: ... "}'
```

## 3. record_session_finish [IMPLEMENTED]
Description:
This tool is called at the end of a pytest session. It records summary information about the entire test run, such as the total number of tests, the counts of passed, failed, and skipped tests, and the exit status of the pytest process. It also updates the status of the "TestRun_Latest" entity to "finished".

**Implementation Details:**
- Input validation for summary object
- Basic response generation with session summary
- Error handling for invalid parameters

Input Schema:
```
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

Expected Behavior:

Update TestRun_Latest Status: Updates the "TestRun_Latest" entity's observation "status: running" to "status: finished".
Add Summary Observations: Adds observations to the "TestRun_Latest" entity for total_tests, passed, failed, skipped, and exitstatus based on the input summary.
Add End Time Observation: Adds an observation with the format "end_time: <timestamp>" to the "TestRun_Latest" entity.

Example Interaction (run in cline window):
```
use_mcp_tool pytest-mcp record_session_finish '{"summary": {"total_tests": 10, "passed": 7, "failed": 2, "skipped": 1, "exitstatus": 0}}'
```
## Debugging the service
```
node ~/workspace/mcp-pytest-server/index.js
```
```
ps aux | grep index.js
sudo tcpdump -i any -s 0 -w mcp_traffic.pcap port <port_number>
```
cline
```
use_pytest-mcp
```

#Development
Suggested Optimizations:
## Faster JSON
Use a Faster JSON Library: Replace the built-in json module with orjson for faster parsing and serialization.

import orjson as json

## Dispatch mechanism
Implement a Dispatch Mechanism: Use dictionaries to map request types and tool names to handler functions.

def handle_list_tools(request):
    # ...

def handle_record_session_start(args):
    # ...

# ... other tool handlers ...

request_handlers = {
    "list_tools": handle_list_tools,
    "call_tool": {
        "record_session_start": handle_record_session_start,
        # ... other tools ...
    }
}

def handle_request(request):
    request_type = request["type"]
    handler = request_handlers.get(request_type)

    if handler:
        if request_type == "call_tool":
            tool_name = request["name"]
            tool_handler = handler.get(tool_name)
            if tool_handler:
                tool_handler(request["arguments"])
            else:
                send_response({"type": "error", "code": -32601, "message": f"Unknown tool: {tool_name}"})
        else:
            handler(request)
    else:
        send_response({"type": "error", "code": -32601, "message": f"Unknown request type: {request_type}"})

## Concurrency
Concurrency: Explore using asynchronous programming (e.g., asyncio) or threading to handle multiple requests concurrently. This would require more significant changes to the server's structure.

## Python SDK Implementation Summary

### Current Status
- Python SDK package structure created at ~/workspace/mcp-pytest-server/python-sdk
- Basic package files implemented:
  - setup.py with package configuration
  - src/mcp/__init__.py with version information
- Package successfully installed in development mode using pip install -e .
- PYTHONPATH configuration verified to allow package import
- Currently running as a development installation with full source access
- Service level: Development/Testing (not production-ready)

### Service Level Details
- **Development Mode**: Running with pip install -e . allows for immediate code changes without reinstallation
- **Source Access**: Full access to source code for debugging and development
- **Dependencies**: Managed through setup.py with direct access to local development environment
- **Stability**: Suitable for testing and development, not recommended for production use
- **Performance**: May include debug logging and unoptimized code paths

### Remaining Tasks
- Implement core MCP client functionality in Python SDK
- Add pytest integration hooks
- Create proper test suite for Python SDK
- Publish package to PyPI for easier distribution
- Optimize for production deployment
