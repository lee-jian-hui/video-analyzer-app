import subprocess, json

def start_mock_mcp():
    return subprocess.Popen(
        ["python", "tools/addition_mcp.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True
    )

def send_mcp_message(proc, message):
    proc.stdin.write(json.dumps(message) + "\n")
    proc.stdin.flush()
    return json.loads(proc.stdout.readline())
