# Use an official, lightweight Microsoft image that includes PowerShell Core
FROM mcr.microsoft.com/powershell:lts-alpine-3.18

# Set the working directory inside the container
WORKDIR /setup

# Copy our PowerShell script into the container
COPY setup-es.ps1 .

# The command that will be executed when the container starts
# `pwsh` is the command for PowerShell Core.
CMD ["pwsh", "-File", "./setup-es.ps1"]