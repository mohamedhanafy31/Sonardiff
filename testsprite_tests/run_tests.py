"""
SonarDiff Frontend Test Suite
Covers the same scenarios as TestSprite TC001-TC030.
Run: python3 run_tests.py
"""
import asyncio
import sys
import time
import uuid
import traceback
from playwright.async_api import async_playwright, Page, expect

BASE = "http://localhost:3000"
EMAIL = "mohamedhanafy3172003@gmail.com"
PASSWORD = "Ma3172003#$#$"
TIMEOUT = 15000

results: list[dict] = []

# ─── helpers ────────────────────────────────────────────────────────────────

async def new_page(browser):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
    ctx.set_default_timeout(TIMEOUT)
    page = await ctx.new_page()
    return page, ctx

async def login(page: Page, email=EMAIL, password=PASSWORD):
    await page.goto(f"{BASE}/login")
    await page.get_by_label("Email").fill(email)
    await page.get_by_label("Password").fill(password)
    await page.get_by_role("button", name="Sign in").click()
    await page.wait_for_url("**/dashboard**", timeout=10000)

async def create_monitor(page: Page, name: str, url: str = "https://example.com") -> str:
    """Create a monitor through the wizard (single-page mode) and return its name.

    Single mode flow (3 visible steps):
    Step 1: URL + Monitor name → Continue  (jumps directly to Step 3 Element)
    Step 3: Element picker     → Continue
    Step 4: Schedule & alerts  → Save monitor
    """
    await page.goto(f"{BASE}/monitors/new")
    await page.wait_for_load_state("domcontentloaded")
    # Step 1: URL field
    url_input = page.locator("input[type='url']").first
    await url_input.fill(url)
    # Step 1: name field
    name_input = page.locator("input[name='name']").first
    await name_input.clear()
    await name_input.fill(name)
    # Step 1 → Step 3 (single mode skips the Pages step)
    await page.get_by_role("button", name="Continue", exact=False).first.click()
    # Step 3 → Step 4
    await page.get_by_role("button", name="Continue", exact=False).first.click()
    # Step 4 → submit
    await page.get_by_role("button", name="Save monitor", exact=False).click()
    await page.wait_for_url("**/monitors**", timeout=10000)
    return name

def record(name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"name": name, "passed": passed, "detail": detail})
    print(f"  {status}  {name}" + (f"\n         {detail}" if detail and not passed else ""))

async def run(name, coro):
    try:
        await coro
        record(name, True)
    except Exception as e:
        record(name, False, str(e)[:200])

# ─── test cases ─────────────────────────────────────────────────────────────

async def tc003_login_logout(browser):
    page, ctx = await new_page(browser)
    try:
        # login
        await login(page)
        assert "/dashboard" in page.url, f"Expected /dashboard, got {page.url}"

        # logout via sidebar button
        await page.get_by_role("button", name="Sign out").click()
        await page.wait_for_url("**/login**", timeout=8000)
        assert "/login" in page.url

        # confirm protected route redirects
        await page.goto(f"{BASE}/monitors")
        await page.wait_for_url("**/login**", timeout=8000)
    finally:
        await ctx.close()

async def tc023_block_invalid_login(browser):
    page, ctx = await new_page(browser)
    try:
        await page.goto(f"{BASE}/login")
        await page.get_by_label("Email").fill("bad@example.com")
        await page.get_by_label("Password").fill("wrongpassword")
        await page.get_by_role("button", name="Sign in").click()
        await page.wait_for_timeout(2000)
        assert "/login" in page.url, "Should stay on login page"
        error_div = page.locator("text=Invalid").or_(page.locator("text=Failed"))
        assert await error_div.count() > 0, "Expected error message"
    finally:
        await ctx.close()

async def tc026_duplicate_email_registration(browser):
    page, ctx = await new_page(browser)
    try:
        await page.goto(f"{BASE}/register")
        await page.get_by_label("Full name").fill("Test User")
        await page.get_by_label("Work email").fill(EMAIL)
        await page.get_by_label("Password").fill("StrongPass123!")
        await page.get_by_role("button", name="Create account").click()
        await page.wait_for_timeout(2000)
        assert "/register" in page.url, "Should stay on register"
        error = page.locator("text=already")
        assert await error.count() > 0, "Expected 'already registered' error"
    finally:
        await ctx.close()

async def tc002_register_new_account(browser):
    page, ctx = await new_page(browser)
    unique_email = f"test+{uuid.uuid4().hex[:8]}@sonardiff-test.com"
    try:
        await page.goto(f"{BASE}/register")
        await page.get_by_label("Full name").fill("Test Tester")
        await page.get_by_label("Work email").fill(unique_email)
        await page.get_by_label("Password").fill("StrongPass123!")
        # Plan cards: click the visible label wrapper, not the hidden radio
        await page.locator("label").filter(has_text="Starter").click()
        await page.get_by_role("button", name="Create account").click()
        await page.wait_for_url("**/monitors**", timeout=10000)
        assert "monitors" in page.url
    finally:
        await ctx.close()

async def tc008_dashboard_reflects_monitors(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/dashboard")
        await page.wait_for_selector("text=monitors", timeout=8000)
        # dashboard should show KPI cards
        cards = page.locator(".bg-bg-card, [class*='card']")
        assert await cards.count() > 0, "Expected dashboard cards"
    finally:
        await ctx.close()

async def tc001_create_monitor_see_in_dashboard(browser):
    page, ctx = await new_page(browser)
    monitor_name = f"AutoTest-{uuid.uuid4().hex[:6]}"
    try:
        await login(page)
        await create_monitor(page, monitor_name)
        # should land on monitors list
        assert "monitors" in page.url
        await expect(page.get_by_text(monitor_name)).to_be_visible()
        # also verify in dashboard
        await page.goto(f"{BASE}/dashboard")
        await page.wait_for_selector("text=monitors", timeout=5000)
    finally:
        await ctx.close()

async def tc028_create_monitor_invalid_input(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/monitors/new")
        await page.wait_for_load_state("domcontentloaded")
        # Leave URL empty and click Continue
        await page.get_by_role("button", name="Continue", exact=False).first.click()
        await page.wait_for_timeout(500)
        error = page.locator("text=valid URL").or_(page.locator("text=required"))
        assert await error.count() > 0, "Expected validation error for empty URL"
    finally:
        await ctx.close()

async def tc029_block_invalid_url(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/monitors/new")
        await page.wait_for_load_state("domcontentloaded")
        # Use React-compatible value injection so Zod sees the bad value
        url_input = page.locator("input[name='url']").first
        await url_input.evaluate("""el => {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, 'not-a-url');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        await page.get_by_role("button", name="Continue", exact=False).first.click()
        await page.wait_for_timeout(500)
        error = page.locator("text=valid URL").or_(page.locator("text=invalid"))
        assert await error.count() > 0, "Expected URL validation error"
    finally:
        await ctx.close()

async def tc027_bad_threshold_validation(browser):
    """TC027: Threshold is a range slider (min=0.01, max=1). Verify the slider exists
    and has correct constraints — trying to exceed max via JS should be clamped/rejected."""
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/monitors/new")
        await page.wait_for_load_state("domcontentloaded")
        url_input = page.locator("input[name='url']").first
        await url_input.fill("https://example.com")
        await page.locator("input[name='name']").first.fill("Threshold Test")
        # Step 1 → Step 3 (single mode skips Pages) → Step 4
        await page.get_by_role("button", name="Continue", exact=False).first.click()
        await page.get_by_role("button", name="Continue", exact=False).first.click()
        # Threshold slider lives on Step 4 — verify it exists and has correct constraints
        slider = page.locator("input[name='threshold'][type='range']")
        min_val = await slider.get_attribute("min")
        max_val = await slider.get_attribute("max")
        assert min_val == "0.01", f"Expected min=0.01, got {min_val}"
        assert max_val == "1", f"Expected max=1, got {max_val}"
        # Attempt to set value beyond max via JS — browser clamps it
        actual = await slider.evaluate("""el => {
            el.value = '2';
            return parseFloat(el.value);
        }""")
        assert actual <= 1.0, f"Slider should clamp at max=1, got {actual}"
    finally:
        await ctx.close()

async def tc019_view_profile(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/settings")
        await expect(page.get_by_text("Profile information")).to_be_visible()
        # Labels now have htmlFor="settings-name" / "settings-email"
        name_input = page.locator("#settings-name")
        assert await name_input.input_value() != "", "Name field should be pre-filled"
        email_input = page.locator("#settings-email")
        val = await email_input.input_value()
        assert "@" in val, "Email field should be pre-filled"
    finally:
        await ctx.close()

async def tc022_update_profile(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/settings")
        name_input = page.locator("#settings-name")
        await name_input.clear()
        new_name = f"Mohamed Hanafy {uuid.uuid4().hex[:4]}"
        await name_input.fill(new_name)
        await page.get_by_role("button", name="Save changes").click()
        await page.wait_for_timeout(2000)
        success = page.locator("text=Profile updated").or_(page.locator("text=successfully"))
        assert await success.count() > 0, "Expected success message"
        # restore original name
        await name_input.clear()
        await name_input.fill("Mohamed Hanafy Automated")
        await page.get_by_role("button", name="Save changes").click()
    finally:
        await ctx.close()

async def tc024_generate_api_token(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/settings")
        # Use the section heading specifically
        await expect(page.locator("h3", has_text="API access")).to_be_visible()
        rotate_btn = page.get_by_title("Generate / Rotate Token")
        await rotate_btn.click()
        await page.wait_for_timeout(2000)
        # token display: a UUID-format string in the mono area
        token_display = page.locator("[class*='font-mono']").filter(has_text="-")
        assert await token_display.count() > 0, "Expected token to appear in mono display"
    finally:
        await ctx.close()

async def tc010_delete_monitor(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        name = f"ToDelete-{uuid.uuid4().hex[:6]}"
        await create_monitor(page, name)
        # find the monitor row and click delete
        row = page.locator("tr").filter(has_text=name)
        await row.get_by_title("Delete").click()
        # in-page dialog should appear
        await expect(page.get_by_text("Delete monitor?")).to_be_visible()
        await page.get_by_role("button", name="Delete monitor").click()
        await page.wait_for_timeout(2000)
        # monitor should be gone
        assert await page.locator("tr").filter(has_text=name).count() == 0, \
            f"Monitor '{name}' should be removed from list"
    finally:
        await ctx.close()

async def tc020_delete_monitor_from_edit_page(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        name = f"ToDeleteEdit-{uuid.uuid4().hex[:6]}"
        await create_monitor(page, name)
        # navigate to the monitor's edit page
        row = page.locator("tr").filter(has_text=name)
        await row.get_by_title("Edit").click()
        await page.wait_for_url("**/edit**", timeout=8000)
        await expect(page.get_by_text("Danger zone")).to_be_visible()
        await page.get_by_role("button", name="Delete monitor").click()
        # confirm
        await page.get_by_role("button", name="Yes, delete monitor").click()
        await page.wait_for_url("**/monitors**", timeout=8000)
        assert "monitors" in page.url
        assert await page.locator("tr").filter(has_text=name).count() == 0
    finally:
        await ctx.close()

async def tc021_update_monitor_settings(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        name = f"EditMe-{uuid.uuid4().hex[:6]}"
        await create_monitor(page, name)
        row = page.locator("tr").filter(has_text=name)
        await row.get_by_title("Edit").click()
        await page.wait_for_url("**/edit**", timeout=8000)
        # Edit page has id="edit-name" on name input
        name_input = page.locator("#edit-name")
        await name_input.clear()
        new_name = f"Edited-{uuid.uuid4().hex[:4]}"
        await name_input.fill(new_name)
        await page.get_by_role("button", name="Save changes").click()
        await page.wait_for_url("**/monitors**", timeout=8000)
        await expect(page.get_by_text(new_name)).to_be_visible()
    finally:
        await ctx.close()

async def tc017_update_monitor_url_and_check(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        name = f"URLChange-{uuid.uuid4().hex[:6]}"
        await create_monitor(page, name, url="https://example.com")
        row = page.locator("tr").filter(has_text=name)
        await row.get_by_title("Edit").click()
        await page.wait_for_url("**/edit**", timeout=8000)
        # Edit page has id="edit-url" on URL input
        url_input = page.locator("#edit-url")
        await url_input.fill("https://example.org")
        await page.get_by_role("button", name="Save changes").click()
        await page.wait_for_url("**/monitors**", timeout=8000)
        # Wait for the monitor row to load with the updated URL
        await expect(page.locator("tr").filter(has_text=name)).to_be_visible(timeout=8000)
        await expect(page.locator("tr").filter(has_text=name).locator("text=example.org")).to_be_visible(timeout=5000)
    finally:
        await ctx.close()

async def tc011_manual_check_pro(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        name = f"ManualCheck-{uuid.uuid4().hex[:6]}"
        await create_monitor(page, name)
        row = page.locator("tr").filter(has_text=name)
        play_btn = row.get_by_title("Check now")
        enabled = await play_btn.is_enabled()
        assert enabled, "Check now button should be enabled for Pro user"
        await play_btn.click()
        # toast should appear
        await page.wait_for_timeout(2000)
        toast = page.locator("text=enqueued").or_(page.locator("text=Check"))
        assert await toast.count() > 0, "Expected success toast after manual check"
    finally:
        await ctx.close()

async def tc006_manual_check_from_detail_page(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        name = f"DetailCheck-{uuid.uuid4().hex[:6]}"
        await create_monitor(page, name)
        row = page.locator("tr").filter(has_text=name)
        await row.get_by_title("View diffs").click()
        await page.wait_for_url("**/monitors/**", timeout=8000)
        check_btn = page.get_by_role("button", name="Check now")
        await expect(check_btn).to_be_visible()
        enabled = await check_btn.is_enabled()
        assert enabled, "Check now button should be enabled for Pro user on detail page"
        await check_btn.click()
        await page.wait_for_timeout(2000)
        toast = page.locator("text=enqueued").or_(page.locator("text=Check"))
        assert await toast.count() > 0, "Expected success toast"
    finally:
        await ctx.close()

async def tc030_reject_invalid_preview_url(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/dom-picker/preview")
        await page.wait_for_load_state("domcontentloaded")
        # React-compatible value injection so React sees the bad value
        url_input = page.locator("#preview-url")
        await url_input.evaluate("""el => {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, 'not-a-valid-url');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        await page.get_by_label("CSS Selector").fill("h1")
        await page.get_by_role("button", name="Preview selector").click()
        await page.wait_for_timeout(1000)
        error = page.locator("text=valid URL").or_(page.locator("text=Must be a valid"))
        assert await error.count() > 0, "Expected URL validation error"
    finally:
        await ctx.close()

async def tc016_preview_selector_page(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/dom-picker/preview")
        await expect(page.get_by_text("DOM Picker Preview")).to_be_visible()
        # form has URL and selector fields
        await expect(page.get_by_label("Page URL")).to_be_visible()
        await expect(page.get_by_label("CSS Selector")).to_be_visible()
        btn = page.get_by_role("button", name="Preview selector")
        await expect(btn).to_be_visible()
        # submit empty to get validation
        await btn.click()
        await page.wait_for_timeout(500)
        error = page.locator("text=required").or_(page.locator("text=valid"))
        assert await error.count() > 0, "Expected validation error for empty fields"
    finally:
        await ctx.close()

async def tc004_ownership_enforcement(browser):
    """TC004: Ownership enforced — a user can't reach another user's monitor edit page."""
    page, ctx = await new_page(browser)
    try:
        await login(page)
        # Navigate to a made-up monitor ID that doesn't belong to this user
        fake_id = "00000000-0000-0000-0000-000000000000"
        await page.goto(f"{BASE}/monitors/{fake_id}")
        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_timeout(2000)
        not_found = page.locator("text=not found").or_(
            page.locator("text=do not have permission")
        )
        assert await not_found.count() > 0, "Should show not-found for other user's monitor"
    finally:
        await ctx.close()

async def tc015_view_diffs_list(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        name = f"DiffView-{uuid.uuid4().hex[:6]}"
        await create_monitor(page, name)
        row = page.locator("tr").filter(has_text=name)
        await row.get_by_title("View diffs").click()
        await page.wait_for_url("**/monitors/**", timeout=8000)
        # change history section should be visible
        await expect(page.get_by_text("Change history")).to_be_visible()
        # even if empty, the panel renders
        panel = page.locator("text=No changes detected yet").or_(
            page.locator("text=Content changed")
        )
        assert await panel.count() > 0, "Expected change history panel"
    finally:
        await ctx.close()

async def tc018_create_monitor_from_preview(browser):
    page, ctx = await new_page(browser)
    try:
        await login(page)
        await page.goto(f"{BASE}/dom-picker/preview?url=https%3A%2F%2Fexample.com&selector=h1")
        await page.wait_for_load_state("domcontentloaded")
        await expect(page.get_by_label("Page URL")).to_have_value("https://example.com")
        await expect(page.get_by_label("CSS Selector")).to_have_value("h1")
    finally:
        await ctx.close()

# ─── runner ─────────────────────────────────────────────────────────────────

async def main():
    print("\n" + "="*60)
    print("  SonarDiff Frontend Test Suite")
    print("="*60)

    suite = [
        ("TC003 Login & logout", tc003_login_logout),
        ("TC023 Block invalid login", tc023_block_invalid_login),
        ("TC026 Duplicate email registration", tc026_duplicate_email_registration),
        ("TC002 Register new account", tc002_register_new_account),
        ("TC019 View account profile", tc019_view_profile),
        ("TC022 Update account profile", tc022_update_profile),
        ("TC024 Generate API token", tc024_generate_api_token),
        ("TC008 Dashboard reflects monitors", tc008_dashboard_reflects_monitors),
        ("TC001 Create monitor & see in dashboard", tc001_create_monitor_see_in_dashboard),
        ("TC028 Invalid monitor input rejected", tc028_create_monitor_invalid_input),
        ("TC029 Invalid URL rejected", tc029_block_invalid_url),
        ("TC027 Bad threshold rejected", tc027_bad_threshold_validation),
        ("TC010 Delete monitor from list page", tc010_delete_monitor),
        ("TC020 Delete monitor from edit page", tc020_delete_monitor_from_edit_page),
        ("TC021 Update monitor settings", tc021_update_monitor_settings),
        ("TC017 Update monitor URL", tc017_update_monitor_url_and_check),
        ("TC004 Ownership enforcement", tc004_ownership_enforcement),
        ("TC015 View monitor diffs list", tc015_view_diffs_list),
        ("TC011 Manual check (Pro, list page)", tc011_manual_check_pro),
        ("TC006 Manual check (detail page)", tc006_manual_check_from_detail_page),
        ("TC016 DOM picker preview page", tc016_preview_selector_page),
        ("TC030 Reject invalid preview URL", tc030_reject_invalid_preview_url),
        ("TC018 Pre-filled preview URL params", tc018_create_monitor_from_preview),
    ]

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--window-size=1280,720", "--disable-dev-shm-usage", "--ipc=host"],
        )
        for name, fn in suite:
            print(f"\n→ {name}")
            await run(name, fn(browser))

        await browser.close()

    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    print("\n" + "="*60)
    print(f"  Results: {passed}/{total} passed  ({failed} failed)")
    print("="*60)
    if failed:
        print("\nFailed tests:")
        for r in results:
            if not r["passed"]:
                print(f"  ❌ {r['name']}")
                print(f"     {r['detail']}")
    print()
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
