# This MASTER script handles all Elastic Stack setup sequentially.

Write-Host "--- Master Setup Script Initializing ---"

# --- Configuration ---
$ElasticUrl = "http://elasticsearch:9200"
$KibanaUrl = "http://kibana:5601"
$MaxRetries = 30
$RetryCount = 0

# ===================================================================
# STAGE 1: Wait for Elasticsearch
# ===================================================================
Write-Host "STAGE 1: Waiting for Elasticsearch to become healthy..."
while ($RetryCount -lt $MaxRetries) {
    try {
        Invoke-WebRequest -Uri "$ElasticUrl/_cluster/health?wait_for_status=yellow" -Method Get -TimeoutSec 5 -Headers @{ "Authorization" = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('elastic:changeme')))" } -UseBasicParsing | Out-Null
        Write-Host "✅ Elasticsearch is healthy."
        break
    } catch {
        $RetryCount++
        Write-Warning "Elasticsearch not ready (Attempt $RetryCount/$MaxRetries). Waiting 5s..."
        Start-Sleep -Seconds 5
    }
    if ($RetryCount -ge $MaxRetries) { Write-Error "FATAL: Elasticsearch did not start."; exit 1 }
}

# ===================================================================
# STAGE 2: Set Kibana System User Password
# ===================================================================
Write-Host "STAGE 2: Setting password for built-in 'kibana_system' user..."
try {
    $SetPasswordUrl = "$ElasticUrl/_security/user/kibana_system/_password"
    $Headers = @{ "Authorization" = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('elastic:changeme')))"; "Content-Type" = "application/json" }
    $Body = @{ "password" = "kibanapass" } | ConvertTo-Json
    Invoke-RestMethod -Uri $SetPasswordUrl -Method Post -Headers $Headers -Body $Body
    Write-Host "✅ Password for 'kibana_system' user set successfully."
} catch {
    Write-Error "FATAL: Failed to set kibana_system password. Error: $($_.Exception.Message)"
    exit 1
}

# ===================================================================
# STAGE 3: Wait for Kibana
# ===================================================================
$RetryCount = 0 # Reset retry counter for Kibana
Write-Host "STAGE 3: Waiting for Kibana to become healthy..."
while ($RetryCount -lt $MaxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "$KibanaUrl/api/status" -Method Get -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $statusObject = $response.Content | ConvertFrom-Json
            if ($statusObject.status.overall.state -eq "green") {
                Write-Host "✅ Kibana is healthy."
                break
            }
        }
    } catch {
        # It's normal to get connection errors here while Kibana starts
    }
    $RetryCount++
    Write-Warning "Kibana not ready (Attempt $RetryCount/$MaxRetries). Waiting 5s..."
    Start-Sleep -Seconds 5
    if ($RetryCount -ge $MaxRetries) { Write-Error "FATAL: Kibana did not start."; exit 1 }
}

# ===================================================================
# STAGE 4: Install APM Integration via Kibana API
# ===================================================================
Write-Host "STAGE 4: Installing APM integration via Kibana API..."
try {
    $InstallUrl = "$KibanaUri/api/fleet/epm/packages/apm"
    $Headers = @{ "kbn-xsrf" = "true"; "Content-Type" = "application/json" }
    $Body = "{}"
    Invoke-RestMethod -Uri $InstallUrl -Method Post -Headers $Headers -Body $Body
    Write-Host "✅ APM integration installed successfully (or was already installed)."
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) { # 409 Conflict is OK
        Write-Host "APM integration was already installed. This is OK."
    } else {
        $errorResponse = $_.Exception.Response.GetResponseStream() | ForEach-Object { (New-Object System.IO.StreamReader($_)).ReadToEnd() }
        Write-Error "FATAL: Failed to install APM integration. Status: $($_.Exception.Response.StatusCode). Response: $errorResponse"
        exit 1
    }
}

Write-Host "--- Master Setup Script Completed Successfully! ---"
exit 0


FROM mcr.microsoft.com/powershell:lts-alpine-3.18
WORKDIR /setup
COPY master-setup.ps1 .
CMD ["pwsh", "-File", "./master-setup.ps1"]