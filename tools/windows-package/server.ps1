# Mini static HTTP server for the 申硕英语词汇学习 Windows bundle.
#
# Why a TcpListener instead of HttpListener?
#   - HttpListener requires URL ACL registration on most Windows installs
#     (needs admin to "netsh http add urlacl ..."). TcpListener doesn't.
#   - This file works on a stock Win10/11 with built-in PowerShell 5.1,
#     no admin needed, no install needed.
#
# Bind only to 127.0.0.1 so the server is never visible to the network.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Port = 5173
$Root = Join-Path $PSScriptRoot 'web'

if (-not (Test-Path $Root)) {
    Write-Host "找不到 web 目录: $Root" -ForegroundColor Red
    Write-Host "请确认你已经把整个文件夹完整解压。" -ForegroundColor Yellow
    Read-Host "按 Enter 关闭"
    exit 1
}

function Get-ContentType {
    param([string]$Path)
    switch ([System.IO.Path]::GetExtension($Path).ToLower()) {
        '.html'  { 'text/html; charset=utf-8' }
        '.htm'   { 'text/html; charset=utf-8' }
        '.js'    { 'application/javascript; charset=utf-8' }
        '.mjs'   { 'application/javascript; charset=utf-8' }
        '.css'   { 'text/css; charset=utf-8' }
        '.json'  { 'application/json; charset=utf-8' }
        '.svg'   { 'image/svg+xml' }
        '.png'   { 'image/png' }
        '.jpg'   { 'image/jpeg' }
        '.jpeg'  { 'image/jpeg' }
        '.gif'   { 'image/gif' }
        '.ico'   { 'image/x-icon' }
        '.woff'  { 'font/woff' }
        '.woff2' { 'font/woff2' }
        '.ttf'   { 'font/ttf' }
        '.txt'   { 'text/plain; charset=utf-8' }
        default  { 'application/octet-stream' }
    }
}

function Send-Response {
    param(
        [System.IO.Stream]$Stream,
        [int]$Status,
        [string]$StatusText,
        [string]$ContentType,
        [byte[]]$Body
    )
    $headers = "HTTP/1.1 $Status $StatusText`r`n" +
               "Content-Type: $ContentType`r`n" +
               "Content-Length: $($Body.Length)`r`n" +
               "Cache-Control: no-store`r`n" +
               "Connection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

function Send-NotFound {
    param([System.IO.Stream]$Stream, [string]$Path)
    $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $Path")
    Send-Response -Stream $Stream -Status 404 -StatusText 'Not Found' `
                  -ContentType 'text/plain; charset=utf-8' -Body $body
}

$endpoint = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener = [System.Net.Sockets.TcpListener]::new($endpoint)
    $listener.Start()
} catch {
    Write-Host "无法占用端口 $Port，可能已经有一个学习软件在运行。" -ForegroundColor Red
    Write-Host "请关掉之前的服务窗口后再启动一次。" -ForegroundColor Yellow
    Read-Host "按 Enter 关闭"
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 申硕英语词汇学习 - 本地服务已启动" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 浏览器地址: http://127.0.0.1:$Port/"
Write-Host " 文件根目录: $Root"
Write-Host ""
Write-Host " 学习时请保持这个窗口打开。"
Write-Host " 关闭这个窗口 = 关闭学习软件。"
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 自动启动浏览器（如果失败也不影响服务运行）
try {
    Start-Process "http://127.0.0.1:$Port/" | Out-Null
} catch {
    Write-Host "未能自动打开浏览器，请手动访问 http://127.0.0.1:$Port/" -ForegroundColor Yellow
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 5000

            # 读取请求头（最多 16KB，足够一个 GET 请求）
            $buffer = New-Object byte[] 16384
            $totalBytes = 0
            $reqText = ''
            while ($totalBytes -lt $buffer.Length) {
                $count = $stream.Read($buffer, $totalBytes, $buffer.Length - $totalBytes)
                if ($count -le 0) { break }
                $totalBytes += $count
                $reqText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $totalBytes)
                if ($reqText.Contains("`r`n`r`n")) { break }
            }
            if (-not $reqText) {
                $client.Close()
                continue
            }

            $firstLine = ($reqText -split "`r`n")[0]
            $parts = $firstLine -split ' '
            if ($parts.Length -lt 2) {
                Send-NotFound -Stream $stream -Path 'bad-request'
                $client.Close()
                continue
            }
            $rawPath = $parts[1]
            # 去掉查询字符串
            $rawPath = ($rawPath -split '\?')[0]
            if ($rawPath -eq '/') { $rawPath = '/index.html' }
            # 解码 %XX，统一斜杠
            $decoded = [System.Uri]::UnescapeDataString($rawPath)
            $relative = $decoded.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $filePath = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))

            # 防止目录穿越攻击
            if (-not $filePath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-NotFound -Stream $stream -Path $decoded
            } elseif (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $contentType = Get-ContentType -Path $filePath
                Send-Response -Stream $stream -Status 200 -StatusText 'OK' `
                              -ContentType $contentType -Body $bytes
            } else {
                Send-NotFound -Stream $stream -Path $decoded
            }
        } catch {
            # 单个请求失败不应该让整个服务退出
            Write-Host "处理请求时出错: $_" -ForegroundColor DarkYellow
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
