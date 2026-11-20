<#
.SYNOPSIS
  Rebuilds everything we made by hand on the KodeKloud Azure playground, after `az login`.

  Creates, in this order:
    infra      registry (ACR) with admin user, Key Vault with two generated passwords, PostgreSQL 16 and its firewall rules
    database   the lira_app role and the tables (api/migrations), and optionally the API tests against the real database
    isolation  the nine tenant-isolation checks of docs/03-sop/rehearsal-isolation-test.sql
    build      builds the web and API Docker images in WSL (no Azure needed: do this any time)
    images     tags the built images with the registry's name and pushes them (builds first if needed)
    deploy     Container Apps environment, the API (internal) and the web app (public)
    edge       Caddy in a container (Let's Encrypt certificate) in front of the web app, and the DNS record to add
    status     checks that everything answers
    all        runs infra, database, images, deploy and edge, stopping to ask before the DNS change

  Run one step at a time (recommended the first time):   .\Setup-Playground.ps1 -Step infra
  Or everything:                                          .\Setup-Playground.ps1 -Step all

.NOTES
  - No password is printed or written to a file. They are generated here and kept in Azure Key Vault.
  - Names that must be unique are saved in .state.json (names only, no secrets), so every step can be re-run safely.
  - The sandbox's policy limits are built in (README.md, "What the sandbox refuses"). If a step stops with
    RequestDisallowedByPolicy, read the Reasons text: it names the setting to change.
  - Needs: Azure CLI, Node 22, and Ubuntu on WSL with Docker (for the images and isolation steps).
#>
param(
  [ValidateSet('check', 'build', 'infra', 'database', 'isolation', 'images', 'deploy', 'edge', 'status', 'all', 'show')]
  [string]$Step = 'check',
  [string]$PgLocation = 'centralus',        # PostgreSQL is refused in eastus for this offer; centralus worked
  [string]$Location = 'eastus',
  [string]$Domain = 'test.liraspaces.com',
  [string]$WebTag = 'v1',
  [string]$ApiTag = 'v1',
  [int]$EdgeDelaySeconds = 600,             # Caddy waits this long, so there is time to change DNS before it asks Let's Encrypt
  [int]$ProxyHops = 3,                      # proxies in front of the API: Caddy, the web app's ingress, nginx. Check source_ip in audit_log.
  [switch]$RunTests
)

$ErrorActionPreference = 'Stop'
# Text piped into a program (the registry password into docker, in WSL) must not start with the invisible UTF-8 marker this PowerShell adds by default.
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$StateFile = Join-Path $PSScriptRoot '.state.json'

# The real Azure CLI program. Our own function is also called Az, and PowerShell would pick the function first, so name the program.
$AzExe = (Get-Command az -CommandType Application | Select-Object -First 1).Source
function Az {
  $ErrorActionPreference = 'Continue'   # Windows PowerShell turns a program's error text into a failure; the exit code is what counts
  $out = & $AzExe @args --only-show-errors 2>&1
  if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed:`n$($out -join "`n")" }
  $out | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }
}
function Az-Exists { $ErrorActionPreference = 'Continue'; & $AzExe @args --only-show-errors 2>&1 | Out-Null; $LASTEXITCODE -eq 0 }
function Load-State { if (Test-Path $StateFile) { Get-Content $StateFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{} } }
function Save-State($s) { $s | ConvertTo-Json | Set-Content $StateFile -Encoding UTF8 }
function Set-Field($s, $name, $value) { $s | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force; Save-State $s }
function New-Secret { $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); 'Aa1-' + (([Convert]::ToBase64String($b)) -replace '[+/=]', 'x') }
function Get-KvSecret($vault, $name) { (Az keyvault secret show --vault-name $vault --name $name --query value -o tsv | Select-Object -First 1) }
function Suffix { Get-Random -Minimum 10000 -Maximum 99999 }
function Need($state, $field, $step) { if (-not $state.$field) { throw "Step '$step' needs '$field' in .state.json. Run the earlier steps first." } }
function Wsl-Path($winPath) { (wsl wslpath -a ($winPath -replace '\\', '/')).Trim() }
function Registry-Args($state) {
  @('--registry-server', "$($state.registry).azurecr.io", '--registry-username', $state.registry,
    '--registry-password', (Az acr credential show -n $state.registry --query 'passwords[0].value' -o tsv | Select-Object -First 1))
}
# create the container app, or update it when it already exists
function Ensure-App($rg, $name, $createArgs, $updateArgs) {
  if (Az-Exists containerapp show -n $name -g $rg) { Az containerapp update -n $name -g $rg @updateArgs | Out-Null }
  else { Az containerapp create -n $name -g $rg @createArgs | Out-Null }
}

function Step-Check($state) {
  Write-Host '== Signed in as:'; Az account show --query '{name:name, user:user.name}' -o table
  foreach ($ns in 'Microsoft.App', 'Microsoft.OperationalInsights', 'Microsoft.ContainerRegistry', 'Microsoft.DBforPostgreSQL', 'Microsoft.KeyVault', 'Microsoft.ContainerInstance') {
    Write-Host ("{0,-34} {1}" -f $ns, (Az provider show -n $ns --query registrationState -o tsv))
  }
  Write-Host '== Resource groups (the sandbox does not let you create one; use the one it gives):'
  Az group list --query '[].{name:name, location:location}' -o table
  Az extension add --name containerapp --upgrade --yes | Out-Null
}

function Step-Infra($state) {
  $rg = (Az group list --query '[0].name' -o tsv | Select-Object -First 1)
  if (-not $rg) { throw 'No resource group found. Is this a playground session?' }
  Set-Field $state 'resourceGroup' $rg

  if (-not $state.registry) { Set-Field $state 'registry' ("liraacr$(Suffix)") }
  Write-Host "== Registry $($state.registry)"
  Az acr create -g $rg -n $state.registry --sku Basic -l $Location | Out-Null
  Az acr update -n $state.registry --admin-enabled true | Out-Null          # needed to push from Docker and for apps to pull

  if (-not $state.vault) { Set-Field $state 'vault' ("kvlira$(Suffix)") }
  Write-Host "== Key Vault $($state.vault)  (policy: standard tier, 7 days soft delete, purge protection cannot be turned off)"
  if (-not (Az-Exists keyvault show -n $state.vault)) {
    Az keyvault create -n $state.vault -g $rg -l $Location --sku standard --retention-days 7 --enable-rbac-authorization false | Out-Null
  }
  foreach ($secret in 'pg-admin-password', 'pg-app-password') {            # only when absent: a new password would no longer match the database
    if (-not (Az-Exists keyvault secret show --vault-name $state.vault --name $secret)) {
      Az keyvault secret set --vault-name $state.vault --name $secret --value (New-Secret) | Out-Null
    }
  }

  if (-not $state.pgServer) { Set-Field $state 'pgServer' ("lirapg$(Suffix)") }
  $myIp = (Invoke-RestMethod https://api.ipify.org).Trim()
  if (-not (Az-Exists postgres flexible-server show -g $rg -n $state.pgServer)) {
    Write-Host "== PostgreSQL $($state.pgServer) in $PgLocation (your IP $myIp is allowed). This takes several minutes."
    Az postgres flexible-server create -g $rg -n $state.pgServer -l $PgLocation --tier Burstable --sku-name Standard_B1ms `
      --storage-size 32 --performance-tier P4 --version 16 --admin-user lirasadmin --admin-password (Get-KvSecret $state.vault 'pg-admin-password') `
      --public-access $myIp --backup-retention 7 --geo-redundant-backup Disabled --storage-auto-grow Disabled `
      --zonal-resiliency Disabled --yes | Out-Null
  }
  # Lets Container Apps reach the database (rehearsal only; the real setup uses a private endpoint)
  Az postgres flexible-server firewall-rule create -g $rg --server-name $state.pgServer --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 | Out-Null
  Set-Field $state 'pgHost' "$($state.pgServer).postgres.database.azure.com"
}

function Step-Database($state) {
  Need $state 'pgHost' 'database'
  $adminUrl = "postgres://lirasadmin:$([uri]::EscapeDataString((Get-KvSecret $state.vault 'pg-admin-password')))@$($state.pgHost):5432/postgres"
  Push-Location (Join-Path $Root 'api')
  try {
    if (-not (Test-Path node_modules)) { npm ci }
    npm run build
    $env:ADMIN_DATABASE_URL = $adminUrl
    $env:APP_DB_PASSWORD = Get-KvSecret $state.vault 'pg-app-password'
    npm run migrate
    if ($RunTests) { $env:TEST_DATABASE_URL = $adminUrl; npm test }
  } finally {
    Remove-Item Env:ADMIN_DATABASE_URL, Env:APP_DB_PASSWORD, Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
    Pop-Location
  }
}

function Step-Isolation($state) {
  Need $state 'pgHost' 'isolation'
  $sql = Wsl-Path (Join-Path $Root 'docs\03-sop')
  # the password goes to WSL on standard input, not on a command line
  (Get-KvSecret $state.vault 'pg-admin-password') | wsl -e bash -lc "LC_ALL=C tr -cd '[:print:]' | { read -r PGPASSWORD; export PGPASSWORD; docker run --rm -e PGPASSWORD -v '${sql}:/sql' postgres:16 psql 'host=$($state.pgHost) port=5432 dbname=postgres user=lirasadmin sslmode=require' -f /sql/rehearsal-isolation-test.sql; }"
  if ($LASTEXITCODE -ne 0) { throw 'The isolation checks failed. Read the FAIL line above.' }
}

function Step-Build {
  $repo = Wsl-Path $Root
  wsl -e bash -lc "set -e; cd '$repo'; docker build -t liraspaces-web:$WebTag lira-app; docker build -t liraspaces-api:$ApiTag api"
  if ($LASTEXITCODE -ne 0) { throw 'Building an image failed. Read the error above. Is Docker running in WSL?' }
}

function Step-Images($state) {
  Need $state 'registry' 'images'
  $acr = "$($state.registry).azurecr.io"
  wsl -e bash -lc "docker image inspect liraspaces-web:$WebTag liraspaces-api:$ApiTag > /dev/null 2>&1"
  if ($LASTEXITCODE -ne 0) { Step-Build }                                   # build now if the images are not there yet
  (Az acr credential show -n $state.registry --query 'passwords[0].value' -o tsv | Select-Object -First 1) | wsl -e bash -lc "LC_ALL=C tr -cd '[:print:]' | docker login $acr -u $($state.registry) --password-stdin"
  if ($LASTEXITCODE -ne 0) { throw 'docker login failed. Is Docker running in WSL?' }
  wsl -e bash -lc "set -e; for pair in web:$WebTag api:$ApiTag; do n=`${pair%%:*}; t=`${pair##*:}; docker tag liraspaces-`$n:`$t $acr/liraspaces-`$n:`$t; docker push $acr/liraspaces-`$n:`$t; done"
  if ($LASTEXITCODE -ne 0) { throw 'Pushing an image failed. Read the error above.' }
}

function Step-Deploy($state) {
  Need $state 'registry' 'deploy'; Need $state 'pgHost' 'deploy'
  $rg = $state.resourceGroup; $acr = $state.registry
  Write-Host '== Container Apps environment (policy: it must be named container-app-env; replicas 0 to 2; no Log Analytics)'
  if (-not (Az-Exists containerapp env show -n container-app-env -g $rg)) {
    Az containerapp env create -n container-app-env -g $rg -l $Location --logs-destination none | Out-Null
  }
  $domainOfEnv = (Az containerapp env show -n container-app-env -g $rg --query 'properties.defaultDomain' -o tsv | Select-Object -First 1)
  $reg = Registry-Args $state

  $dbUrl = "postgres://lira_app:$([uri]::EscapeDataString((Get-KvSecret $state.vault 'pg-app-password')))@$($state.pgHost):5432/postgres"
  $origins = "https://$Domain,https://liraspaces-web.$domainOfEnv"
  Write-Host '== API (internal address only)'
  $apiImage = "$acr.azurecr.io/liraspaces-api:$ApiTag"
  $apiEnv = @('DATABASE_URL=secretref:db-url', "ALLOWED_ORIGINS=$origins", 'COOKIE_SECURE=true', "TRUST_PROXY_HOPS=$ProxyHops")
  Ensure-App $rg 'liraspaces-api' `
    (@('--environment', 'container-app-env', '--image', $apiImage) + $reg + @('--ingress', 'internal', '--target-port', '8080', '--min-replicas', '1', '--max-replicas', '2', '--secrets', "db-url=$dbUrl", '--env-vars') + $apiEnv) `
    (@('--image', $apiImage, '--replace-env-vars') + $apiEnv)
  if (Az-Exists containerapp show -n liraspaces-api -g $rg) { Az containerapp secret set -n liraspaces-api -g $rg --secrets "db-url=$dbUrl" | Out-Null }

  Write-Host '== Web (public address)'
  $webImage = "$acr.azurecr.io/liraspaces-web:$WebTag"
  Ensure-App $rg 'liraspaces-web' `
    (@('--environment', 'container-app-env', '--image', $webImage) + $reg + @('--ingress', 'external', '--target-port', '8080', '--min-replicas', '0', '--max-replicas', '2', '--env-vars', 'API_UPSTREAM=liraspaces-api')) `
    @('--image', $webImage, '--replace-env-vars', 'API_UPSTREAM=liraspaces-api')
  $fqdn = (Az containerapp show -n liraspaces-web -g $rg --query 'properties.configuration.ingress.fqdn' -o tsv | Select-Object -First 1)
  Set-Field $state 'webFqdn' $fqdn
  Write-Host "Web: https://$fqdn   (the first request after idle is slow: it scales to zero)"
}

function Step-Edge($state) {
  # The sandbox refuses every certificate resource, so Caddy (in a container) gets a Let's Encrypt certificate itself.
  Need $state 'webFqdn' 'edge'
  $rg = $state.resourceGroup; $acr = $state.registry
  if (-not $state.edgeLabel) { Set-Field $state 'edgeLabel' ("liraedge$(Suffix)") }
  Az acr import -n $acr --source docker.io/library/caddy:2 --image caddy:2 --force | Out-Null   # Docker Hub pulls from Azure can fail; our registry is reliable
  if (Az-Exists container show -g $rg -n lira-edge) { Az container delete -g $rg -n lira-edge --yes | Out-Null }
  $cmd = "sh -c 'sleep $EdgeDelaySeconds; caddy reverse-proxy --from $Domain --to https://$($state.webFqdn) --change-host-header'"
  Az container create -g $rg -n lira-edge --image "$acr.azurecr.io/caddy:2" --registry-login-server "$acr.azurecr.io" --registry-username $acr `
    --registry-password (Az acr credential show -n $acr --query 'passwords[0].value' -o tsv | Select-Object -First 1) `
    --os-type Linux --sku Standard --cpu 0.5 --memory 0.5 --ports 80 443 --ip-address Public --dns-name-label $state.edgeLabel `
    --restart-policy Always --command-line $cmd | Out-Null
  $edge = "$($state.edgeLabel).$Location.azurecontainer.io"
  Set-Field $state 'edgeFqdn' $edge
  Write-Host "`nNOW, in Hostinger (DNS records for liraspaces.com, TTL 300): delete any old CNAME named 'test', then add"
  Write-Host "  CNAME   name: $($Domain -replace '\.liraspaces\.com$', '')   content: $edge"
  Write-Host "Caddy starts in $EdgeDelaySeconds seconds and then asks Let's Encrypt. Check with:  .\Setup-Playground.ps1 -Step status"
}

function Step-Status($state) {
  $targets = @()
  if ($state.webFqdn) { $targets += "https://$($state.webFqdn)" }
  $targets += "https://$Domain"
  foreach ($base in $targets) {
    Write-Host "== $base"
    foreach ($case in @(@('/health', 200), @('/ready', 200), @('/', 200), @('/login', 200), @('/api/me', 401))) {
      try { $code = (Invoke-WebRequest "$base$($case[0])" -UseBasicParsing -TimeoutSec 60 -MaximumRedirection 0).StatusCode }
      catch { $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'no answer' } }
      $ok = if ($code -eq $case[1]) { 'ok  ' } else { 'FAIL' }
      Write-Host ("  {0} {1,-9} expected {2}, got {3}" -f $ok, $case[0], $case[1], $code)
    }
  }
  Write-Host "`nAlso try in a browser: $($targets[-1])/signup, then /login."
}

$state = Load-State
switch ($Step) {
  'check'     { Step-Check $state; Write-Host 'Next: -Step infra' }
  'build'     { Step-Build; Write-Host 'Built locally. Later, with a registry: -Step images' }
  'infra'     { Step-Infra $state; Write-Host 'Next: -Step database' }
  'database'  { Step-Database $state; Write-Host 'Next: -Step isolation (optional), then -Step images' }
  'isolation' { Step-Isolation $state }
  'images'    { Step-Images $state; Write-Host 'Next: -Step deploy' }
  'deploy'    { Step-Deploy $state; Write-Host 'Next: -Step edge' }
  'edge'      { Step-Edge $state }
  'status'    { Step-Status $state }
  'show'      { $state | ConvertTo-Json }
  'all' {
    Step-Check $state; Step-Infra $state; $state = Load-State; Step-Database $state; Step-Images $state; Step-Deploy $state; $state = Load-State
    Step-Edge (Load-State)
    Write-Host "`nChange the DNS record shown above, wait a few minutes, then run:  .\Setup-Playground.ps1 -Step status"
  }
}
