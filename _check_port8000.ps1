$thePids = @(18596, 29064, 37080, 21136, 39988)
foreach ($thePid in $thePids) {
    $proc = Get-Process -Id $thePid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Output ("PID " + $thePid + ": " + $proc.ProcessName)
    } else {
        Write-Output ("PID " + $thePid + ": DEAD")
    }
}
Write-Output "---"
$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    foreach ($c in $conn) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Output ("Owner PID " + $c.OwningProcess + ": " + $proc.ProcessName)
        } else {
            Write-Output ("Owner PID " + $c.OwningProcess + ": DEAD (ghost entry)")
        }
    }
} else {
    Write-Output "No LISTEN connections on port 8000"
}
