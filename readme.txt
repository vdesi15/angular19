We will go back to the two-script approach. This is the correct pattern.
File: setup/setup-es-user.ps1 (Script 1 - For Elasticsearch)
# SCRIPT 1: Creates the dedicated user for Kibana in Elasticsearch.
$ErrorActionPreference = "Stop"
Write-Host "--- ES User Setup Script Initializing ---"

$ElasticUrl = "http://elasticsearch:9200"
$AuthHeader = @{ "Authorization" = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('elastic:changeme')))" }
$JsonHeader = @{ "Content-Type" = "application/json" }

# Wait for Elasticsearch to be healthy
$retries = 24
while ($retries -gt 0) {
    try {
        Invoke-WebRequest -Uri "$ElasticUrl/_cluster/health?wait_for_status=yellow" -Headers $AuthHeader -UseBasicParsing | Out-Null
        Write-Host "✅ Elasticsearch is healthy."
        break
    } catch {
        $retries--
        Write-Warning "ES not ready. Retries left: $retries. Waiting 5s..."
        Start-Sleep -Seconds 5
        if ($retries -eq 0) { throw "FATAL: Elasticsearch did not start." }
    }
}

# Create the user WITH the correct role. We use PUT to make this idempotent (safe to run multiple times).
Write-Host "Creating/updating user 'kibana_user' with 'kibana_admin' role..."
try {
    $UserUrl = "$ElasticUrl/_security/user/kibana_user"
    $UserBody = @{
        "password" = "kibanapass"
        "roles" = [ "kibana_admin" ] # This is the key permission
        "full_name" = "Kibana Service User"
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri $UserUrl -Method Put -Headers ($AuthHeader + $JsonHeader) -Body $UserBody
    Write-Host "✅ User 'kibana_user' created/updated successfully."
} catch {
    Write-Error "FATAL: Failed to create Kibana user. Error: $($_.Exception.Message)"
    exit 1
}

exit 0
Use code with caution.
Powershell
File: setup/setup-apm-integration.ps1 (Script 2 - For Kibana)
# SCRIPT 2: Installs the APM integration via the Kibana API.
$ErrorActionPreference = "Stop"
Write-Host "--- Kibana APM Integration Setup Script Initializing ---"

$KibanaUrl = "http://kibana:5601"

# Wait for Kibana to be healthy
Write-Host "Waiting for Kibana to become healthy..."
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
    if ($retries -eq 0) { throw "FATAL: Kibana did not start." }
}

# Install the integration
Write-Host "Installing APM integration..."
try {
    $InstallUrl = "$KibanaUrl/api/fleet/epm/packages/apm"
    $Headers = @{ "kbn-xsrf" = "true"; "Content-Type" = "application/json" }
    $Body = "{}" # A simple empty body is often sufficient
    Invoke-RestMethod -Uri $InstallUrl -Method Post -Headers $Headers -Body $Body
    Write-Host "✅ APM integration installed or already present."
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) { # 409 Conflict is OK
        Write-Host "APM integration was already installed."
    } else {
        $errorResponse = $_.Exception.Response.GetResponseStream() | ForEach-Object { (New-Object System.IO.StreamReader($_)).ReadToEnd() }
        throw "FATAL: Failed to install APM integration. Status: $($_.Exception.Response.StatusCode). Response: $errorResponse"
    }
}

exit 0
Use code with caution.
Powershell
Step 2: The Two Dockerfiles
You will have two Dockerfiles in your setup folder.
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
Step 3: The Final, Correct docker-compose.yml
This version has the correct, linear dependency chain.
version: '3.9'

services:
  # ... (seal-ui, e2e-runner)

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.2
    container_name: elasticsearch
    ports: ['9200:9200']
    volumes: ['es-data:/usr/share/elasticsearch/data']
    networks: ['monitoring-net']
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=changeme
    healthcheck:
      test: ["CMD-SHELL", "curl -s -f -u elastic:changeme http://localhost:9200/_cluster/health?wait_for_status=yellow"]
      interval: 10s
      timeout: 10s
      retries: 24

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
    container_name: kibana
    ports: ['5601:5601']
    networks:
      - monitoring-net
    # Kibana waits for the user to be created before it starts.
    depends_on:
      es-user-setup:
        condition: service_completed_successfully
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=kibana_user # The new user we created
      - ELASTICSEARCH_PASSWORD=kibanapass
    healthcheck:
      test: ["CMD-SHELL", "curl -s -f http://localhost:5601/api/status | grep -q '\"state\":\"green\"'"]
      interval: 10s
      timeout: 10s
      retries: 24

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
    container_name: apm-server
    ports: ['8200:8200']
    networks:
      - monitoring-net
    # APM Server waits for the APM integration to be installed before it starts.
    depends_on:
      kibana-apm-setup:
        condition: service_completed_successfully
    environment:
      - OUTPUT_ELASTICSEARCH_USERNAME=elastic
      - OUTPUT_ELASTICSEARCH_PASSWORD=changeme
      - APM_SERVER_HOST=0.0.0.0:8200
      - OUTPUT_ELASTICSEARCH_HOSTS=["elasticsearch:9200"]
      - APM_SERVER_RUM_ENABLED=true
      - KIBANA_HOST=kibana:5601
      
volumes:
  es-data:
    driver: local