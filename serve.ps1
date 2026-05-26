$prefix = 'http://127.0.0.1:8000/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Live server running at $prefix"

function Get-ContentType($file) {
    switch ([System.IO.Path]::GetExtension($file).ToLowerInvariant()) {
        '.html' { 'text/html; charset=utf-8' }
        '.htm' { 'text/html; charset=utf-8' }
        '.js' { 'application/javascript; charset=utf-8' }
        '.css' { 'text/css; charset=utf-8' }
        '.json' { 'application/json; charset=utf-8' }
        '.geojson' { 'application/geo+json; charset=utf-8' }
        '.png' { 'image/png' }
        '.jpg' { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.svg' { 'image/svg+xml; charset=utf-8' }
        default { 'application/octet-stream' }
    }
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath.TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = Join-Path (Get-Location).Path $path

    if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.ContentType = Get-ContentType $file
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
        $ctx.Response.ContentType = 'text/plain; charset=utf-8'
        $resp = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $ctx.Response.ContentLength64 = $resp.Length
        $ctx.Response.OutputStream.Write($resp, 0, $resp.Length)
    }

    $ctx.Response.OutputStream.Close()
}
