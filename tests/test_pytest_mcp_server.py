import pytest
from mcp.client.stdio import stdio_client, StdioServerParameters

@pytest.fixture
def mcp_client():
    return stdio_client(server=StdioServerParameters(
        command="pytest-mcp"
    ))

def test_server_connection(mcp_client):
    """Test that the server is running and accessible"""
    tools = mcp_client.list_tools()
    assert isinstance(tools, list)
    assert len(tools) > 0

def test_method_availability(mcp_client):
    """Test that required methods are available"""
    tools = mcp_client.list_tools()
    tool_names = [tool["name"] for tool in tools]
    assert "record_session_start" in tool_names
    assert "record_test_outcome" in tool_names
    assert "record_session_finish" in tool_names

def test_error_handling(mcp_client):
    """Test error handling for invalid method requests"""
    with pytest.raises(Exception) as exc_info:
        mcp_client.call_tool("invalid_method", {})
    assert "Method not found" in str(exc_info.value)
