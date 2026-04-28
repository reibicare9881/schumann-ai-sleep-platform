#!/usr/bin/env pwsh

# ===========================================
# 统一多平台 API 测试脚本
# Test Unified Multi-Platform API
# ===========================================

$API_URL = "http://localhost:8000"
$RESULTS = @()

# 颜色定义
$GREEN = "`e[32m"
$RED = "`e[31m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$RESET = "`e[0m"

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [object]$Body = $null
    )
    
    $url = "$API_URL$Endpoint"
    
    try {
        Write-Host "${BLUE}→ $Description${RESET}"
        Write-Host "  $Method $Endpoint"
        
        if ($Body) {
            $response = Invoke-RestMethod -Uri $url -Method $Method -Body ($Body | ConvertTo-Json) -ContentType "application/json"
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $Method
        }
        
        Write-Host "${GREEN}✓ 成功${RESET}"
        Write-Host "  响应: $($response.status)"
        Write-Host ""
        
        $RESULTS += @{ name = $Description; status = "✓" }
        return $response
    } catch {
        Write-Host "${RED}✗ 失败${RESET}: $($_.Exception.Message)"
        Write-Host ""
        $RESULTS += @{ name = $Description; status = "✗" }
        return $null
    }
}

# ===========================================
# 开始测试
# ===========================================

Write-Host "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
Write-Host "${BLUE}  統一多平台 API 測試${RESET}"
Write-Host "${BLUE}  API: $API_URL${RESET}"
Write-Host "${BLUE}  時間: $(Get-Date)${RESET}"
Write-Host "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
Write-Host ""

# 1. 健康检查
Write-Host "${YELLOW}[1/7] 系統檢查${RESET}"
Write-Host ""

Test-Endpoint "GET" "/" "主健康檢查" | Out-Null
Test-Endpoint "GET" "/api/health" "API 詳細檢查" | Out-Null
Test-Endpoint "GET" "/api/platforms" "獲取平台列表" | Out-Null

Write-Host ""

# 2. 认证测试
Write-Host "${YELLOW}[2/7] 認證系統${RESET}"
Write-Host ""

$sleepLogin = Test-Endpoint "POST" "/api/auth/login" "睡眠平台 - 個人用戶登入" @{
    platform = "sleep"
    role = "individual"
}

$schumannLogin = Test-Endpoint "POST" "/api/auth/login" "舒曼共振平台登入" @{
    platform = "schumann"
}

Write-Host ""

# 3. 睡眠平台测试
Write-Host "${YELLOW}[3/7] 睡眠平台 - 評估提交${RESET}"
Write-Host ""

if ($sleepLogin) {
    $userId = $sleepLogin.data.user.id
    
    $assessment = Test-Endpoint "POST" "/api/sleep/assessment" "提交睡眠評估" @{
        user_id = $userId
        profile = @{
            age = 35
            gender = "male"
            dept = "IT"
        }
        sleep_scores = @{
            s1 = 2
            s2 = 2
            s3 = 1
            s4 = 1
            s5 = 2
            s6 = 1
            s7 = 1
        }
        pain_scores = @{
            p1 = 3
            p2 = 2
            p3 = 1
            p4 = 2
            p5 = 1
        }
        work_scores = @{
            w1 = 1
            w2 = 2
            w3 = 1
        }
    }
    
    Write-Host ""
    Write-Host "${YELLOW}[4/7] 睡眠平台 - 報告查詢${RESET}"
    Write-Host ""
    
    Test-Endpoint "GET" "/api/sleep/reports?user_id=$userId" "獲取報告列表" | Out-Null
    
    if ($assessment) {
        $reportId = $assessment.data.report_id
        Test-Endpoint "GET" "/api/sleep/reports/$reportId" "獲取單份報告詳情" | Out-Null
        Test-Endpoint "GET" "/api/sleep/analysis/$userId" "獲取分析數據" | Out-Null
    }
}

Write-Host ""

# 4. 舒曼共振平台测试
Write-Host "${YELLOW}[5/7] 舒曼共振平台${RESET}"
Write-Host ""

if ($schumannLogin) {
    $schumannUserId = $schumannLogin.data.user.id
    
    Test-Endpoint "POST" "/api/schumann/upload?user_id=$schumannUserId" "上傳舒曼報告" @{
        name = "測試用戶"
        hr_pre = 75
        hr_post = 65
        sdnn_pre = 28
        sdnn_post = 35
    } | Out-Null
    
    Test-Endpoint "GET" "/api/schumann/reports?user_id=$schumannUserId" "獲取舒曼報告列表" | Out-Null
}

Write-Host ""

# 5. 平台切换测试
Write-Host "${YELLOW}[6/7] 平台切換${RESET}"
Write-Host ""

if ($sleepLogin) {
    $userId = $sleepLogin.data.user.id
    $session = $sleepLogin.data.session
    
    Test-Endpoint "POST" "/api/auth/switch-platform?user_id=$userId&from_platform=sleep&to_platform=schumann" "睡眠 → 舒曼 切換" | Out-Null
}

Write-Host ""

# 6. 汇总结果
Write-Host "${YELLOW}[7/7] 測試結果${RESET}"
Write-Host ""

$successCount = ($RESULTS | Where-Object { $_.status -eq "✓" }).Count
$failCount = ($RESULTS | Where-Object { $_.status -eq "✗" }).Count

Write-Host "${BLUE}測試摘要:${RESET}"
Write-Host ""

foreach ($result in $RESULTS) {
    if ($result.status -eq "✓") {
        Write-Host "${GREEN}✓${RESET} $($result.name)"
    } else {
        Write-Host "${RED}✗${RESET} $($result.name)"
    }
}

Write-Host ""
Write-Host "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
Write-Host "總計: ${GREEN}$successCount 個成功${RESET} / ${RED}$failCount 個失敗${RESET}"
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "${GREEN}✨ 所有測試通過！${RESET}"
    Write-Host ""
    Write-Host "後端 API 狀態: ${GREEN}✅ 健康${RESET}"
} else {
    Write-Host "${RED}⚠ 部分測試失敗${RESET}"
    Write-Host ""
    Write-Host "請檢查:"
    Write-Host "  1. 後端是否在執行: python main.py"
    Write-Host "  2. API 地址是否正確: $API_URL"
    Write-Host "  3. API 文檔: $API_URL/docs"
}

Write-Host ""
Write-Host "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
