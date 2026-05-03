$prefix = 'http://127.0.0.1:8000/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Live server running at $prefix"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath.TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = Join-Path (Get-Location).Path $path

    if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
        $resp = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $ctx.Response.ContentLength64 = $resp.Length
        $ctx.Response.OutputStream.Write($resp, 0, $resp.Length)
    }

    $ctx.Response.OutputStream.Close()
}
