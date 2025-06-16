File: setup/setup-es-user.ps1 (New Script 1)
# SCRIPT 1: Sets up the user in Elasticsearch.

Write-Host "--- ES User Setup Script ---"
$ElasticUrl = "http://elasticsearch:9200"

# Wait for Elasticsearch
Write-Host "Waiting for Elasticsearch..."
$retries = 24
while ($retries -gt 0) {
    try {
        Invoke-WebRequest -Uri "$ElasticUrl/_cluster/health?wait_for_status=yellow" -Headers @{ "Authorization" = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('elastic:changeme')))" } -UseBasicParsing | Out-Null
        Write-Host "✅ ES is healthy."
        break
    } catch {
        $retries--
        Write-Warning "ES not ready. Retries left: $retries. Waiting 5s..."
        Start-Sleep -Seconds 5
        if ($retries -eq 0) { Write-Error "FATAL: ES did not start."; exit 1 }
    }
}

# Set the password
Write-Host "Setting password for 'kibana_system' user..."
try {
    $SetPasswordUrl = "$ElasticUrl/_security/user/kibana_system/_password"
    $Headers = @{ "Authorization" = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('elastic:changeme')))"; "Content-Type" = "application/json" }
    $Body = @{ "password" = "kibanapass" } | ConvertTo-Json
    Invoke-RestMethod -Uri $SetPasswordUrl -Method Post -Headers $Headers -Body $Body
    Write-Host "✅ Password set."
} catch {
    Write-Error "FATAL: Failed to set password. Error: $($_.Exception.Message)"
    exit 1
}

exit 0
Use code with caution.
Powershell
File: setup/setup-apm-integration.ps1 (New Script 2)
# SCRIPT 2: Installs the APM integration in Kibana.

Write-Host "--- Kibana APM Integration Setup Script ---"
$KibanaUrl = "http://kibana:5601"

# Wait for Kibana
Write-Host "Waiting for Kibana..."
$retries = 24
while ($retries -gt 0) {
    try {
        $response = Invoke-WebRequest -Uri "$KibanaUrl/api/status" -Method Get -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $statusObject = $response.Content | ConvertFrom-Json
            if ($statusObject.status.overall.state -eq "green") {
                Write-Host "✅ Kibana is healthy."
                break
            }
        }
    } catch {}
    $retries--
    Write-Warning "Kibana not ready. Retries left: $retries. Waiting 5s..."
    Start-Sleep -Seconds 5
    if ($retries -eq 0) { Write-Error "FATAL: Kibana did not start."; exit 1 }
}

# Install the integration
Write-Host "Installing APM integration..."
try {
    $InstallUrl = "$KibanaUrl/api/fleet/epm/packages/apm"
    $Headers = @{ "kbn-xsrf" = "true"; "Content-Type" = "application/json" }
    $Body = "{}"
    Invoke-RestMethod -Uri $InstallUrl -Method Post -Headers $Headers -Body $Body
    Write-Host "✅ APM integration installed or already present."
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "APM integration already installed (Conflict 409)."
    } else {
        $errorResponse = $_.Exception.Response.GetResponseStream() | ForEach-Object { (New-Object System.IO.StreamReader($_)).ReadToEnd() }
        Write-Error "FATAL: Failed to install APM integration. Status: $($_.Exception.Response.StatusCode). Response: $errorResponse"
        exit 1
    }
}
exit 0
Use code with caution.
Powershell
Step 2: Create a Dockerfile for Each Script
You'll need two Dockerfiles in your setup directory.
File: setup/Dockerfile.es
FROM mcr.microsoft.com/powershell:lts-alpine-3.18
WORKDIR /setup
COPY setup-es-user.ps1 .
CMD ["pwsh", "-File", "./setup-es-user.ps1"]
Use code with caution.
Dockerfile
File: setup/Dockerfile.apm
FROM mcr.microsoft.com/powershell:lts-alpine-3.18
WORKDIR /setup
COPY setup-apm-integration.ps1 .
CMD ["pwsh", "-File", "./setup-apm-integration.ps1"]
Use code with caution.
Dockerfile
Step 3: Final docker-compose.yml with Linear Dependencies
This version correctly chains the dependencies without any circles.
version: '3.9'

services:
  # ... (seal-ui, e2e-runner)

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.2
    # ...
    healthcheck:
      test: ["CMD-SHELL", "curl -s -f -u elastic:changeme http://localhost:9200/_cluster/health?wait_for_status=yellow"]
      # ...

  # Container 1: Sets up the user in ES
  es-user-setup:
    container_name: es-user-setup
    build:
      context: ./setup
      dockerfile: Dockerfile.es
    networks:
      - monitoring-net
    depends_on:
      elasticsearch:
        condition: service_healthy

  kibana:
    image: docker.elastic.co/kibana/kibana:8.12.2
    # ...
    # Kibana waits for the user to be created before it starts.
    depends_on:
      es-user-setup:
        condition: service_completed_successfully
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=kibana_system
      - ELASTICSEARCH_PASSWORD=kibanapass
    healthcheck:
      test: ["CMD-SHELL", "curl -s -f http://localhost:5601/api/status | grep -q '\"state\":\"green\"'"]
      # ...

  # Container 2: Installs the APM package in Kibana
  kibana-apm-setup:
    container_name: kibana-apm-setup
    build:
      context: ./setup
      dockerfile: Dockerfile.apm
    networks:
      - monitoring-net
    # It waits for Kibana to be fully healthy before it runs.
    depends_on:
      kibana:
        condition: service_healthy

  apm-server:
    image: docker.elastic.co/apm/apm-server:8.12.2
    # ...
    # APM Server waits for the APM integration to be installed before it starts.
    depends_on:
      kibana-apm-setup:
        condition: service_completed_successfully
    environment:
      # ... (APM config)
      
volumes:
  es-data:
    driver: local
