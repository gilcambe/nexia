#!/bin/bash
# Run npm test to verify all tests pass and new behavior is correctly implemented
set -e

# Navigate to the correct directory if needed
if [ -f "package.json" ]; then
    echo "Running npm test..."
    npm test
else
    echo "package.json not found in current directory"
    exit 1
fi

# Check the exit status
if [ $? -eq 0 ]; then
    echo "✅ All tests passed! New behavior is correctly implemented."
    exit 0
else
    echo "❌ Some tests failed. Please check the output above."
    exit 1
fi