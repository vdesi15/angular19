# This script waits for Elasticsearch to be fully ready and then sets the password
# for the built-in kibana_system user via its API.

# --- Configuration ---
$ElasticUrl = "http://elasticsearch:9200"
$MaxRetries = 24 # Try for 2 minutes (24 attempts * 5 seconds)
$RetryCount = 0

Write-Host "--- Elasticsearch Setup Initializing (PowerShell) ---"

# --- Stage 1: Wait for Elasticsearch to be healthy ---
Write-Host "Polling Elasticsearch health at $ElasticUrl/_cluster/health"
while ($RetryCount -lt $MaxRetries) {
    $RetryCount++
    Write-Host "Attempt $($RetryCount) of $($MaxRetries): Checking Elasticsearch status..."
    try {
        # Use basic parsing for compatibility. Check for status code first.
        $response = Invoke-WebRequest -Uri "$ElasticUrl/_cluster/health?wait_for_status=yellow" -Method Get -TimeoutSec 5 -UseBasicParsing -Headers @{ "Authorization" = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('elastic:changeme')))" }
        
        if ($response.StatusCode -eq 200) {
            Write-Host "Elasticsearch is healthy! Proceeding."
            break # Exit the loop
        }
    }
    catch {
        Write-Warning "Elasticsearch not yet responding. Waiting 5 seconds... ($($_.Exception.Message))"
    }
    
    if ($RetryCount -ge $MaxRetries) {
        Write-Error "Elasticsearch did not become available. Exiting."
        exit 1
    }
    
    Start-Sleep -Seconds 5
}

# --- Stage 2: Set password for kibana_system user ---
$SetPasswordUrl = "$ElasticUrl/_security/user/kibana_system/_password"
$Headers = @{
    "Authorization" = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('elastic:changeme')))"
    "Content-Type" = "application/json"
}
$Body = @{
    "password" = "kibanapass"
} | ConvertTo-Json

try {
    Write-Host "Attempting to set password for kibana_system user..."
    Invoke-RestMethod -Uri $SetPasswordUrl -Method Post -Headers $Headers -Body $Body
    Write-Host "✅ Successfully set password for kibana_system user."
}
catch {
    $statusCode = $_.Exception.Response.StatusCode
    if ($statusCode -eq 404) {
        # This can happen if the user doesn't exist yet, let's try creating it.
        # This part of the logic is more complex and less likely needed, but as a fallback:
        Write-Warning "User kibana_system not found, attempting to create might be needed if this were a custom user."
    }
    # For any other error, fail loudly.
    $errorResponse = $_.Exception.Response.GetResponseStream() | ForEach-Object { (New-Object System.IO.StreamReader($_)).ReadToEnd() }
    Write-Error "Failed to set password. Status: $statusCode. Response: $errorResponse"
    exit 1
}

Write-Host "--- Elasticsearch Setup Complete ---"
exit 0
