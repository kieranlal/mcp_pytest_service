import pytest
import pytest_asyncio
from mcp.client.stdio import stdio_client, StdioServerParameters

@pytest_asyncio.fixture
async def mcp_client():
    async with stdio_client(server=StdioServerParameters(
        command="pytest-mcp"
    )) as client:
        yield client

@pytest.mark.asyncio
async def test_server_connection(mcp_client):
    """Test that the server is running and accessible"""
    tools = await mcp_client.list_tools()
    assert isinstance(tools, list)
    assert len(tools) > 0

@pytest.mark.asyncio
async def test_method_availability(mcp_client):
    """Test that required methods are available"""
    tools = await mcp_client.list_tools()
    tool_names = [tool["name"] for tool in tools]
    assert "record_session_start" in tool_names
    assert "record_test_outcome" in tool_names
    assert "record_session_finish" in tool_names

@pytest.mark.asyncio
async def test_error_handling(mcp_client):
    """Test error handling for invalid method requests"""
    with pytest.raises(Exception) as exc_info:
        await mcp_client.call_tool("invalid_method", {})
    assert "Method not found" in str(exc_info.value)

@pytest.mark.asyncio
async def test_resource_listing(mcp_client):
    """Test listing available resources"""
    resources = await mcp_client.list_resources()
    assert isinstance(resources, list)
    assert len(resources) > 0
    assert all(isinstance(resource, dict) for resource in resources)

@pytest.mark.asyncio
async def test_resource_reading(mcp_client):
    """Test reading a specific resource"""
    resources = await mcp_client.list_resources()
    if resources:
        resource = resources[0]
        content = await mcp_client.read_resource(resource["uri"])
        assert isinstance(content, dict)
        assert "contents" in content

@pytest.mark.asyncio
async def test_tool_execution(mcp_client):
    """Test executing a tool with valid parameters"""
    tools = await mcp_client.list_tools()
    if tools:
        tool = tools[0]
        result = await mcp_client.call_tool(tool["name"], {})
        assert isinstance(result, dict)

@pytest.mark.asyncio
async def test_session_recording(mcp_client):
    """Test session recording workflow"""
    # Start session
    session_id = await mcp_client.call_tool("record_session_start", {
        "test_suite": "pytest",
        "environment": "test"
    })
    assert isinstance(session_id, str)

    # Record test outcome
    test_result = await mcp_client.call_tool("record_test_outcome", {
        "session_id": session_id,
        "test_name": "test_session_recording",
        "status": "passed"
    })
    assert test_result is True

    # Finish session
    session_stats = await mcp_client.call_tool("record_session_finish", {
        "session_id": session_id
    })
    assert isinstance(session_stats, dict)
    assert "tests_run" in session_stats

@pytest.mark.asyncio
async def test_invalid_resource_handling(mcp_client):
    """Test error handling for invalid resource requests"""
    with pytest.raises(Exception) as exc_info:
        await mcp_client.read_resource("invalid://resource")
    assert "Resource not found" in str(exc_info.value)

@pytest.mark.asyncio
async def test_invalid_tool_parameters(mcp_client):
    """Test error handling for invalid tool parameters"""
    tools = await mcp_client.list_tools()
    if tools:
        tool = tools[0]
        with pytest.raises(Exception) as exc_info:
            await mcp_client.call_tool(tool["name"], {"invalid": "params"})
        assert "Invalid parameters" in str(exc_info.value)
