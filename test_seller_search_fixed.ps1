# Test Seller Search After Deployment
Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "  SELLER SEARCH VERIFICATION TEST" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$baseUrl = "https://velontri-backend.onrender.com/api/v1"

Write-Host "`n1. Testing /users/search endpoint..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/users/search?q=nbi&page=1&page_size=20" -Method Get
    
    if ($response.success) {
        $users = $response.data.users
        $total = $response.data.meta.total
        
        Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
        Write-Host "   Total users found: $total" -ForegroundColor White
        
        if ($users -and $users.Count -gt 0) {
            Write-Host "`n   📋 User Results:" -ForegroundColor Cyan
            foreach ($user in $users) {
                Write-Host "      • $($user.full_name)" -ForegroundColor White
                Write-Host "        ID: $($user.id)" -ForegroundColor Gray
                Write-Host "        Followers: $($user.followers_count)" -ForegroundColor Gray
                Write-Host "        Verified: $($user.seller_verification_status)" -ForegroundColor Gray
                Write-Host ""
            }
            
            # Check if Nbi Stars is in results
            $nbiUser = $users | Where-Object { $_.full_name -like "*Nbi*" }
            if ($nbiUser) {
                Write-Host "   ✅ 'Nbi Stars' found in results!" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ 'Nbi Stars' not in results" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ⚠️ No users returned (but endpoint works)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ FAILED: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n   This might mean:" -ForegroundColor Yellow
    Write-Host "   • Render is still deploying (wait 5-10 min)" -ForegroundColor Gray
    Write-Host "   • Backend is down or restarting" -ForegroundColor Gray
    Write-Host "   • Network connectivity issue" -ForegroundColor Gray
}

Write-Host "`n2. Testing other search terms..." -ForegroundColor Yellow

$testTerms = @("test", "john", "seller")
foreach ($term in $testTerms) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/users/search?q=$term&page=1&page_size=5" -Method Get
        if ($response.success) {
            $count = $response.data.meta.total
            Write-Host "   ✅ '$term': $count users found" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ❌ '$term': Failed" -ForegroundColor Red
    }
}

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLETE" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "  1. Check frontend at: https://velontri.vercel.app/search" -ForegroundColor Cyan
Write-Host "  2. Click 'Sellers' tab and search for 'nbi'" -ForegroundColor Gray
Write-Host "  3. Verify results display correctly" -ForegroundColor Gray
Write-Host ""
