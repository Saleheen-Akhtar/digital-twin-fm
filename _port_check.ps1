$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen
foreach ($c in $conn) {
    $p = Get-Process -Id $c.OwningProcess
    Write-Output ("PID: " + $c.OwningProcess + " Name: " + $p.ProcessName)
}
