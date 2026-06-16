#!/bin/bash
# Auto-inject frontend-dev skill when user is working on frontend files/tasks

input=$(cat)

# Extract tool name and file path from hook input
tool_name=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)
tool_input=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tool_input',{})))" 2>/dev/null)

# Check if tool is file-editing related
if [[ "$tool_name" =~ ^(Edit|Write|MultiEdit)$ ]]; then
  file_path=$(echo "$tool_input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))" 2>/dev/null)

  # Check if file is in frontend territory
  if echo "$file_path" | grep -qE "(src/components|src/routes|src/styles|src/hooks|\.tsx$|\.css$)"; then
    SKILL_FILE="$(dirname "$0")/../commands/frontend-dev.md"
    if [ -f "$SKILL_FILE" ]; then
      echo "$(cat "$SKILL_FILE")"
    fi
  fi
fi
