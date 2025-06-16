# This script waits for Kibana to be ready and then installs the APM integration via its API.

# --- Configuration ---
$KibanaUri = "http://kibana:5601"
$ApiStatusUrl = "$KibanaUri/api/status"
$MaxRetries = 24 # Try for 2 minutes (24 attempts * 5 seconds)
$RetryCount = 0

Write-Host "--- Kibana APM Setup Initializing ---"
Write-Host "Polling Kibana status at: $ApiStatusUrl"

# --- Robust Polling Loop ---
while ($RetryCount -lt $MaxRetries) {
    $RetryCount++
    Write-Host "Attempt $RetryCount of $MaxRetries: Checking Kibana status..."
    
    try {
        # Use -UseBasicParsing to avoid issues in some environments.
        # We check the raw content to see if it's valid JSON before trying to parse.
        $response = Invoke-WebRequest -Uri $ApiStatusUrl -Method Get -TimeoutSec 5 -UseBasicParsing
        
        if ($response.StatusCode -eq 200) {
            # Convert the content from JSON to a PowerShell object
            $statusObject = $response.Content | ConvertFrom-Json
            $overallState = $statusObject.status.overall.state

            Write-Host "Kibana responded with state: $overallState"

            if ($overallState -eq "green" -or $overallState -eq "yellow") {
                Write-Host "Kibana is up and running! Proceeding with APM integration setup."
                # Break the loop and proceed to the next step
                break
            }
        }
    }
    catch {
        # This will catch network errors like 'Connection refused'
        Write-Warning "Kibana is not yet available. Waiting 5 seconds... (Error: $($_.Exception.Message))"
    }
    
    # If we are here, it means Kibana is not ready yet, or the loop should continue.
    if ($RetryCount -ge $MaxRetries) {
        Write-Error "Kibana did not become available after $MaxRetries retries. Exiting with error."
        exit 1 # Exit with a failure code
    }
    
    Start-Sleep -Seconds 5
}

# --- Install APM Integration ---
# This part of the logic is likely correct and will only run after the loop above succeeds.
$InstallUrl = "$KibanaUri/api/fleet/epm/packages/apm"
$Headers = @{ "kbn-xsrf" = "true" }
$Body = @{ "force" = $true } | ConvertTo-Json

try {
    Write-Host "Sending command to install APM integration..."
    Invoke-RestMethod -Uri $InstallUrl -Method Post -Headers $Headers -Body $Body -ContentType "application/json"
    Write-Host "APM integration installation command sent successfully."
}
catch {
    # If the integration is already installed, Kibana returns a 409 Conflict error. We can safely ignore this.
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "APM integration appears to be already installed (Conflict 409). This is OK."
    }
    else {
        # For any other error, print the details and exit with a failure code.
        $errorResponse = $_.Exception.Response.GetResponseStream() | ForEach-Object { (New-Object System.IO.StreamReader($_)).ReadToEnd() }
        Write-Error "Failed to install APM integration. Status: $($_.Exception.Response.StatusCode). Response: $errorResponse"
        exit 1
    }
}

Write-Host "--- Kibana APM Setup Complete ---"
exit 0