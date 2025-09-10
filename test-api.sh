#!/bin/bash

API_BASE="http://localhost:3001"

echo "=== MAAS Frontend API Test Script ==="
echo

# Check if server is running
echo "1. Testing server status..."
STATUS=$(curl -s "${API_BASE}/api/config/status")
echo "Config Status: $STATUS"
echo

# Get available machines
echo "2. Getting ready machines..."
MACHINES=$(curl -s "${API_BASE}/api/machines" | jq -r '.[] | select(.status_name == "Ready") | .system_id' | head -2)
echo "Ready machines:"
echo "$MACHINES"
echo

if [ -z "$MACHINES" ]; then
    echo "No ready machines available for testing"
    echo "Testing with invalid machine ID..."
    TEST_MACHINE="invalid-machine-id"
else
    TEST_MACHINE=$(echo "$MACHINES" | head -1)
    echo "Using machine: $TEST_MACHINE"
fi
echo

# Start provisioning job
echo "3. Starting provisioning job..."
RESPONSE=$(curl -s -X POST "${API_BASE}/api/provision" \
  -H "Content-Type: application/json" \
  -d "{
    \"machines\": [\"$TEST_MACHINE\"],
    \"distro_series\": \"jammy\",
    \"user_data\": \"#!/bin/bash\\necho 'API test deployment at $(date)' > /tmp/api-test.txt\"
  }")

echo "Response: $RESPONSE"
JOB_ID=$(echo "$RESPONSE" | jq -r '.job_id')
echo "Job ID: $JOB_ID"
echo

if [ "$JOB_ID" != "null" ] && [ -n "$JOB_ID" ]; then
    # Wait and check status
    echo "4. Checking job status (waiting 5 seconds)..."
    sleep 5
    
    STATUS=$(curl -s "${API_BASE}/api/provision/${JOB_ID}")
    echo "Job Status:"
    echo "$STATUS" | jq '.'
    echo
    
    # List all jobs
    echo "5. Listing all provisioning jobs..."
    ALL_JOBS=$(curl -s "${API_BASE}/api/provision")
    echo "All Jobs:"
    echo "$ALL_JOBS" | jq '.jobs[] | {id, status, created_at, total_machines, successful_deployments, failed_deployments}'
else
    echo "Failed to get job ID"
fi

echo
echo "=== Test Complete ==="