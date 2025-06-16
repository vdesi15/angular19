# This script waits for Kibana to be ready and then installs the APM integration via its API.

$KibanaUrl = "http://kibana:5601"
$MaxRetries = 24 # Try for 2 minutes (24 * 5 seconds)
$RetryCount = 0

Write-Host "--- Kibana APM Setup Initializing ---"

# Loop until Kibana is available or we run out of retries.
while ($RetryCount -lt $MaxRetries) {
    try {
        $StatusResponse = Invoke-RestMethod -Uri "$KibanaUrl/api/status" -Method Get -TimeoutSec 5
        # Check if the overall status is green or yellow (meaning it's ready)
        if ($StatusResponse.status.overall.state -eq "green" -or $StatusResponse.status.overall.state -eq "yellow") {
            Write-Host "Kibana is up and running! Proceeding with APM integration setup."
            break # Exit the loop
        }
    }
    catch {
        # This will catch connection errors, timeouts, etc.
        Write-Host "Kibana is not yet available. Waiting 5 seconds... ($($_.Exception.Message))"
    }
    
    Start-Sleep -Seconds 5
    $RetryCount++
}

if ($RetryCount -eq $MaxRetries) {
    Write-Error "Kibana did not become available after $MaxRetries retries. Exiting with error."
    exit 1
}

# Now, install the APM integration.
# This API endpoint installs the latest available version of the APM package.
$InstallUrl = "$KibanaUrl/api/fleet/epm/packages/apm"
$Headers = @{
    "kbn-xsrf" = "true"
}
$Body = @{
    "force" = $true
} | ConvertTo-Json

try {
    Write-Host "Sending command to install APM integration..."
    $InstallResponse = Invoke-RestMethod -Uri $InstallUrl -Method Post -Headers $Headers -Body $Body -ContentType "application/json"
    Write-Host "APM integration installation command sent successfully."
    # You can optionally inspect $InstallResponse here.
}
catch {
    # This might happen if the integration is already installed. We can treat it as a success.
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "APM integration appears to be already installed (Conflict 409). This is OK."
    }
    else {
        Write-Error "Failed to install APM integration. Status: $($_.Exception.Response.StatusCode). Response: $($_.Exception.Response.GetResponseStream() | ForEach-Object { (New-Object System.IO.StreamReader($_)).ReadToEnd() })"
        exit 1
    }
}

Write-Host "--- Kibana APM Setup Complete ---"
exit 0