#!/bin/sh

# This script is executed by the elasticsearch-setup container.
# It waits for Elasticsearch to be healthy and then sets the password for the built-in kibana_system user.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting Elasticsearch Setup ---"

# --- Stage 1: Wait for Elasticsearch to be healthy ---
echo "Waiting for Elasticsearch health at http://elasticsearch:9200..."
# We use a while loop and `curl`'s exit code to poll.
# The `-o /dev/null` discards the output, we only care about the success/failure.
until curl -s -f -u elastic:changeme http://elasticsearch:9200/_cluster/health?wait_for_status=yellow -o /dev/null; do
  echo "Elasticsearch not ready yet, sleeping 5s..."
  sleep 5
done
echo "Elasticsearch is healthy!"

# --- Stage 2: Set password for kibana_system user ---
echo "Attempting to set password for kibana_system user..."
# We explicitly check the exit code of the curl command.
if curl -f -X POST -u elastic:changeme -H 'Content-Type: application/json' http://elasticsearch:9200/_security/user/kibana_system/_password -d '{"password" : "kibanapass"}' > /dev/null; then
  echo "✅ Successfully set password for kibana_system user."
else
  echo "❌ ERROR: Failed to set password for kibana_system user. The curl command failed."
  # The `set -e` at the top will cause the script to exit with a failure code here.
  exit 1
fi

echo "--- Elasticsearch Setup Complete ---"
# The script will exit with code 0 (success) here.