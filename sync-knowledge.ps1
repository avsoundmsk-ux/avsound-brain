# AVSound knowledge base sync script
# Run after updating business/, marketing/, products_db/
# Usage: .\sync-knowledge.ps1

$base = "C:\Users\avsou\OneDrive\Desktop\claude"
$kb   = "$base\avtozvuk-agent\knowledge"
$date = Get-Date -Format "yyyy-MM-dd HH:mm"

Write-Host "=== AVSound Knowledge Sync ===" -ForegroundColor Cyan
Write-Host "Date: $date"
Write-Host ""

function Merge-Files {
    param([string]$output, [string[]]$inputs, [string]$label)
    $header = "# $label`n`n> Auto-synced: $date`n`n"
    $body = ""
    foreach ($src in $inputs) {
        $path = "$base\$src"
        if (Test-Path $path) {
            $body += (Get-Content $path -Raw -Encoding utf8) + "`n`n---`n`n"
        } else {
            Write-Host "  [SKIP] $src not found" -ForegroundColor Yellow
        }
    }
    [System.IO.File]::WriteAllText($output, ($header + $body), [System.Text.Encoding]::UTF8)
    Write-Host "  [OK] $label" -ForegroundColor Green
}

# 01 - company info
Merge-Files -output "$kb\01_company.md" `
    -inputs @("business\company.md","business\mission.md","business\sales_channels.md") `
    -label "AVSound - company base"

# 02 - brands and products
Merge-Files -output "$kb\02_brands.md" `
    -inputs @("products_db\brands.md","products_db\amplifiers.md","products_db\speakers.md","products_db\subwoofers.md","products_db\dsp.md","products_db\multimedia.md") `
    -label "AVSound - brands and products"

# 03 - services and pricing
Merge-Files -output "$kb\03_services.md" `
    -inputs @("business\services.md","business\pricing.md","studio\installation_standards.md") `
    -label "AVSound - services and pricing"

# 04 - marketing
Merge-Files -output "$kb\04_marketing.md" `
    -inputs @("marketing\social_media.md","marketing\telegram.md","marketing\avito.md") `
    -label "AVSound - marketing"

# 05 - FAQ and objections
Merge-Files -output "$kb\05_support.md" `
    -inputs @("business\faq.md","business\objections.md","team\scripts.md") `
    -label "AVSound - FAQ and sales scripts"

# 08 - sales process (new)
Merge-Files -output "$kb\08_sales.md" `
    -inputs @("business\sales_process.md","business\kpi.md") `
    -label "AVSound - sales process"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Updated: $kb"
