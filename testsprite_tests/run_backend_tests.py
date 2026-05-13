"""
SonarDiff Backend E2E / Integration Test Suite
Hits the running API server directly via HTTP.

Run: python3 run_backend_tests.py
"""
import sys
import time
import uuid
import httpx

BASE = "http://localhost:3001/api"
PRO_EMAIL = "mohamedhanafy3172003@gmail.com"
PRO_PASSWORD = "Ma3172003#$#$"

# Plan limits (must mirror backend src/lib/config.ts)
FREE_MIN_INTERVAL = 1440
PRO_MIN_INTERVAL = 60
FREE_PLAN_LIMIT = 150
FREE_MAX_MONITORS = 5

results: list[dict] = []
created_user_tokens: list[str] = []  # for cleanup
created_monitor_ids: list[tuple[str, str]] = []  # (token, monitor_id)
created_group_ids: list[tuple[str, str]] = []   # (token, group_id) — cleanup before users


# ─── helpers ────────────────────────────────────────────────────────────────

def record(name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"name": name, "passed": passed, "detail": detail})
    print(f"  {status}  {name}" + (f"\n         {detail}" if detail and not passed else ""))


def check(name, fn):
    try:
        fn()
        record(name, True)
    except AssertionError as e:
        record(name, False, str(e)[:300])
    except Exception as e:
        record(name, False, f"{type(e).__name__}: {e}"[:300])


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register_fresh_user(client: httpx.Client, plan: str = "free") -> tuple[str, str, str]:
    """Returns (email, password, token)."""
    email = f"test+{uuid.uuid4().hex[:10]}@sonardiff-test.com"
    password = "TestPassword123!"
    r = client.post(f"{BASE}/auth/register", json={
        "email": email, "password": password, "name": "Test User", "plan": plan,
    })
    assert r.status_code == 201, f"register failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    created_user_tokens.append(token)
    return email, password, token


def login_pro(client: httpx.Client) -> str:
    r = client.post(f"{BASE}/auth/login", json={"email": PRO_EMAIL, "password": PRO_PASSWORD})
    assert r.status_code == 200, f"pro login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def create_monitor(client: httpx.Client, token: str, **overrides) -> dict:
    body = {
        "name": f"M-{uuid.uuid4().hex[:6]}",
        "url": "https://example.com",
        "checkIntervalMinutes": PRO_MIN_INTERVAL,  # default to pro min, override for free
    }
    body.update(overrides)
    r = client.post(f"{BASE}/monitors", json=body, headers=auth_headers(token))
    assert r.status_code == 201, f"create monitor failed: {r.status_code} {r.text}"
    monitor = r.json()["monitor"]
    created_monitor_ids.append((token, monitor["id"]))
    return monitor


# ─── 1. Health ──────────────────────────────────────────────────────────────

def t_healthz(client):
    def fn():
        r = client.get(f"{BASE}/healthz")
        assert r.status_code == 200, r.status_code
        body = r.json()
        assert body.get("status") == "ok", body
        assert "timestamp" in body
    check("HEALTH-01 GET /healthz", fn)


# ─── 2. Auth: register ──────────────────────────────────────────────────────

def t_register_valid(client):
    def fn():
        email = f"reg+{uuid.uuid4().hex[:8]}@sonardiff-test.com"
        r = client.post(f"{BASE}/auth/register", json={
            "email": email, "password": "ValidPass123!", "name": "Reg User",
        })
        assert r.status_code == 201, f"{r.status_code} {r.text}"
        body = r.json()
        assert "token" in body
        assert body["user"]["email"] == email
        assert body["user"]["plan"] == "free"
        assert body["user"]["planLimit"] == FREE_PLAN_LIMIT
        assert "manualChecksUsedThisPeriod" in body["user"]
        created_user_tokens.append(body["token"])
    check("AUTH-01 register valid", fn)


def t_register_pro_plan(client):
    def fn():
        email = f"pro+{uuid.uuid4().hex[:8]}@sonardiff-test.com"
        r = client.post(f"{BASE}/auth/register", json={
            "email": email, "password": "ValidPass123!", "name": "Pro User", "plan": "pro",
        })
        assert r.status_code == 201, f"{r.status_code} {r.text}"
        assert r.json()["user"]["plan"] == "pro"
        created_user_tokens.append(r.json()["token"])
    check("AUTH-02 register with plan=pro", fn)


def t_register_missing_fields(client):
    def fn():
        r = client.post(f"{BASE}/auth/register", json={"email": "x@y.com"})
        assert r.status_code == 400, f"{r.status_code} {r.text}"
        assert "error" in r.json()
    check("AUTH-03 register missing fields", fn)


def t_register_short_password(client):
    def fn():
        r = client.post(f"{BASE}/auth/register", json={
            "email": f"short+{uuid.uuid4().hex[:6]}@sonardiff-test.com",
            "password": "short", "name": "Short",
        })
        assert r.status_code == 400, f"{r.status_code} {r.text}"
    check("AUTH-04 register password too short", fn)


def t_register_duplicate_email(client):
    def fn():
        email = f"dup+{uuid.uuid4().hex[:8]}@sonardiff-test.com"
        body = {"email": email, "password": "ValidPass123!", "name": "Dup"}
        r1 = client.post(f"{BASE}/auth/register", json=body)
        assert r1.status_code == 201
        created_user_tokens.append(r1.json()["token"])
        r2 = client.post(f"{BASE}/auth/register", json=body)
        assert r2.status_code == 409, f"{r2.status_code} {r2.text}"
    check("AUTH-05 register duplicate email → 409", fn)


def t_register_email_normalization(client):
    """Email is lowercased & trimmed, so MIXED-case duplicates also collide."""
    def fn():
        base = f"norm+{uuid.uuid4().hex[:8]}@sonardiff-test.com"
        body1 = {"email": base, "password": "ValidPass123!", "name": "Norm"}
        r1 = client.post(f"{BASE}/auth/register", json=body1)
        assert r1.status_code == 201
        created_user_tokens.append(r1.json()["token"])
        body2 = {"email": base.upper(), "password": "ValidPass123!", "name": "Norm"}
        r2 = client.post(f"{BASE}/auth/register", json=body2)
        assert r2.status_code == 409, f"upper-case email should collide: {r2.status_code}"
    check("AUTH-06 email normalization rejects case-different dup", fn)


# ─── 3. Auth: login ─────────────────────────────────────────────────────────

def t_login_valid(client):
    def fn():
        email, pw, _ = register_fresh_user(client)
        r = client.post(f"{BASE}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert "token" in r.json()
    check("AUTH-07 login valid", fn)


def t_login_wrong_password(client):
    def fn():
        email, _, _ = register_fresh_user(client)
        r = client.post(f"{BASE}/auth/login", json={"email": email, "password": "WrongPass1!"})
        assert r.status_code == 401, f"{r.status_code} {r.text}"
    check("AUTH-08 login wrong password → 401", fn)


def t_login_unknown_email(client):
    def fn():
        r = client.post(f"{BASE}/auth/login", json={
            "email": f"nope+{uuid.uuid4().hex}@nowhere.com", "password": "Whatever1!",
        })
        assert r.status_code == 401, f"{r.status_code} {r.text}"
    check("AUTH-09 login unknown email → 401", fn)


def t_login_missing_fields(client):
    def fn():
        r = client.post(f"{BASE}/auth/login", json={"email": "a@b.c"})
        assert r.status_code == 400, f"{r.status_code} {r.text}"
    check("AUTH-10 login missing fields → 400", fn)


# ─── 4. Auth: protected boundaries ──────────────────────────────────────────

def t_me_no_auth(client):
    def fn():
        r = client.get(f"{BASE}/auth/me")
        assert r.status_code == 401, f"{r.status_code} {r.text}"
    check("AUTH-11 GET /me no token → 401", fn)


def t_me_malformed_header(client):
    def fn():
        r = client.get(f"{BASE}/auth/me", headers={"Authorization": "Token foo"})
        assert r.status_code == 401, r.status_code
    check("AUTH-12 GET /me non-Bearer header → 401", fn)


def t_me_bad_token(client):
    def fn():
        r = client.get(f"{BASE}/auth/me", headers=auth_headers("invalid-session-token-zzz"))
        assert r.status_code == 401, r.status_code
    check("AUTH-13 GET /me invalid token → 401", fn)


def t_me_valid(client):
    def fn():
        email, _, token = register_fresh_user(client)
        r = client.get(f"{BASE}/auth/me", headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        u = r.json()["user"]
        assert u["email"] == email
        assert u["plan"] == "free"
        assert u["planLimit"] == FREE_PLAN_LIMIT
        # newly registered: no token yet
        assert u.get("apiToken") in (None, "")
    check("AUTH-14 GET /me valid → 200", fn)


# ─── 5. Auth: PATCH /me ─────────────────────────────────────────────────────

def t_patch_me_name(client):
    def fn():
        _, _, token = register_fresh_user(client)
        new_name = f"Renamed-{uuid.uuid4().hex[:4]}"
        r = client.patch(f"{BASE}/auth/me", json={"name": new_name}, headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json()["user"]["name"] == new_name
    check("AUTH-15 PATCH /me update name", fn)


def t_patch_me_short_password(client):
    def fn():
        _, _, token = register_fresh_user(client)
        r = client.patch(f"{BASE}/auth/me", json={"password": "x"}, headers=auth_headers(token))
        assert r.status_code == 400, f"{r.status_code} {r.text}"
    check("AUTH-16 PATCH /me short password → 400", fn)


def t_patch_me_password_then_login(client):
    """Update password and verify the new password works for login."""
    def fn():
        email, _, token = register_fresh_user(client)
        new_pw = "NewPassword456!"
        r = client.patch(f"{BASE}/auth/me", json={"password": new_pw}, headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        # old pw should fail
        r_old = client.post(f"{BASE}/auth/login", json={"email": email, "password": "TestPassword123!"})
        assert r_old.status_code == 401, f"old pw should not work: {r_old.status_code}"
        # new pw should succeed
        r_new = client.post(f"{BASE}/auth/login", json={"email": email, "password": new_pw})
        assert r_new.status_code == 200, f"new pw failed: {r_new.status_code} {r_new.text}"
    check("AUTH-17 password change actually rotates credential", fn)


# ─── 6. Auth: API token ─────────────────────────────────────────────────────

def t_api_token_generate(client):
    def fn():
        _, _, token = register_fresh_user(client)
        r = client.post(f"{BASE}/auth/api-token", headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        api_token = r.json()["apiToken"]
        assert api_token and "-" in api_token
        # rotating returns a new one
        r2 = client.post(f"{BASE}/auth/api-token", headers=auth_headers(token))
        assert r2.status_code == 200
        assert r2.json()["apiToken"] != api_token, "rotated token should differ"
    check("AUTH-18 generate + rotate API token", fn)


# ─── 7. Auth: logout / delete ───────────────────────────────────────────────

def t_logout_invalidates_session(client):
    def fn():
        _, _, token = register_fresh_user(client)
        # works before
        r1 = client.get(f"{BASE}/auth/me", headers=auth_headers(token))
        assert r1.status_code == 200
        # logout
        r2 = client.post(f"{BASE}/auth/logout", headers=auth_headers(token))
        assert r2.status_code == 200, f"{r2.status_code} {r2.text}"
        # fails after
        r3 = client.get(f"{BASE}/auth/me", headers=auth_headers(token))
        assert r3.status_code == 401, f"session still valid after logout: {r3.status_code}"
    check("AUTH-19 logout invalidates session", fn)


def t_delete_me_cascade(client):
    def fn():
        email, pw, token = register_fresh_user(client)
        r = client.delete(f"{BASE}/auth/me", headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        # session is gone
        r2 = client.get(f"{BASE}/auth/me", headers=auth_headers(token))
        assert r2.status_code == 401, f"session survived delete: {r2.status_code}"
        # email is now reusable
        r3 = client.post(f"{BASE}/auth/register", json={
            "email": email, "password": pw, "name": "Reborn",
        })
        assert r3.status_code == 201, f"email should be free after delete: {r3.status_code} {r3.text}"
        created_user_tokens.append(r3.json()["token"])
    check("AUTH-20 DELETE /me cascade frees email", fn)


# ─── 8. Monitors: auth & ownership ─────────────────────────────────────────

def t_monitors_no_auth(client):
    def fn():
        r = client.get(f"{BASE}/monitors")
        assert r.status_code == 401, r.status_code
    check("MON-01 GET /monitors no auth → 401", fn)


def t_monitors_list_empty(client):
    def fn():
        _, _, token = register_fresh_user(client)
        r = client.get(f"{BASE}/monitors", headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json()["monitors"] == []
    check("MON-02 GET /monitors empty for new user", fn)


def t_create_monitor_pro(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token, name=f"PRO-{uuid.uuid4().hex[:6]}")
        assert m["url"] == "https://example.com"
        assert m["checkIntervalMinutes"] == PRO_MIN_INTERVAL
        assert m["isActive"] is True
        assert float(m["threshold"]) == 0.01
    check("MON-03 create monitor (Pro)", fn)


def t_create_monitor_missing_fields(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/monitors",
                        json={"name": "x"}, headers=auth_headers(token))
        assert r.status_code == 400, f"{r.status_code} {r.text}"
    check("MON-04 create missing fields → 400", fn)


def t_create_monitor_below_plan_min(client):
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        # free min is 1440; try 60
        r = client.post(f"{BASE}/monitors",
                        json={"name": "x", "url": "https://e.com", "checkIntervalMinutes": 60},
                        headers=auth_headers(token))
        assert r.status_code == 403, f"{r.status_code} {r.text}"
        assert "minimum" in r.json().get("error", "").lower() or "plan" in r.json().get("error", "").lower()
    check("MON-05 free user interval < min → 403", fn)


def t_create_monitor_invalid_threshold(client):
    def fn():
        token = login_pro(client)
        for bad in [0, -0.5, 1.5, "abc"]:
            r = client.post(f"{BASE}/monitors", json={
                "name": f"x-{bad}", "url": "https://e.com",
                "checkIntervalMinutes": PRO_MIN_INTERVAL,
                "threshold": bad,
            }, headers=auth_headers(token))
            assert r.status_code == 400, f"threshold={bad} expected 400, got {r.status_code} {r.text}"
    check("MON-06 invalid threshold → 400", fn)


def t_create_monitor_free_no_selector(client):
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        r = client.post(f"{BASE}/monitors", json={
            "name": "x", "url": "https://e.com",
            "checkIntervalMinutes": FREE_MIN_INTERVAL,
            "cssSelector": "h1",
        }, headers=auth_headers(token))
        assert r.status_code == 403, f"{r.status_code} {r.text}"
    check("MON-07 free user with cssSelector → 403", fn)


def t_create_monitor_quota_exceeded(client):
    """Registering hourly monitors should hit the 150-check/month free plan cap quickly,
    but free plan also rejects hourly intervals with 'minimum'. Use FREE max-monitors instead."""
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        ids = []
        # Free plan: 5 monitors × daily (1440) → 150 checks/month exactly
        for i in range(FREE_MAX_MONITORS):
            r = client.post(f"{BASE}/monitors", json={
                "name": f"q{i}", "url": "https://example.com",
                "checkIntervalMinutes": FREE_MIN_INTERVAL,
            }, headers=auth_headers(token))
            assert r.status_code == 201, f"monitor {i} failed: {r.status_code} {r.text}"
            mid = r.json()["monitor"]["id"]
            ids.append(mid)
            created_monitor_ids.append((token, mid))
        # 6th monitor → 403 (max monitors reached)
        r = client.post(f"{BASE}/monitors", json={
            "name": "extra", "url": "https://example.com",
            "checkIntervalMinutes": FREE_MIN_INTERVAL,
        }, headers=auth_headers(token))
        assert r.status_code == 403, f"6th monitor should be blocked: {r.status_code} {r.text}"
    check("MON-08 free plan max-monitors enforcement", fn)


def t_get_monitor_own(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token)
        r = client.get(f"{BASE}/monitors/{m['id']}", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["monitor"]["id"] == m["id"]
    check("MON-09 GET /monitors/:id own → 200", fn)


def t_get_monitor_other_user(client):
    """User A creates a monitor; user B gets 404 trying to fetch it."""
    def fn():
        token_a = login_pro(client)
        m = create_monitor(client, token_a)
        _, _, token_b = register_fresh_user(client)
        r = client.get(f"{BASE}/monitors/{m['id']}", headers=auth_headers(token_b))
        assert r.status_code == 404, f"cross-user access should 404, got {r.status_code}"
    check("MON-10 GET other user's monitor → 404", fn)


def t_get_monitor_nonexistent(client):
    def fn():
        token = login_pro(client)
        r = client.get(f"{BASE}/monitors/00000000-0000-0000-0000-000000000000",
                       headers=auth_headers(token))
        assert r.status_code == 404, r.status_code
    check("MON-11 GET nonexistent monitor → 404", fn)


def t_patch_monitor_own(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token)
        r = client.patch(f"{BASE}/monitors/{m['id']}",
                         json={"name": "Renamed Pro"},
                         headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json()["monitor"]["name"] == "Renamed Pro"
    check("MON-12 PATCH /monitors/:id own", fn)


def t_patch_monitor_other_user(client):
    def fn():
        token_a = login_pro(client)
        m = create_monitor(client, token_a)
        _, _, token_b = register_fresh_user(client)
        r = client.patch(f"{BASE}/monitors/{m['id']}",
                         json={"name": "hacked"},
                         headers=auth_headers(token_b))
        assert r.status_code == 404, f"cross-user PATCH should 404, got {r.status_code}"
    check("MON-13 PATCH other user's monitor → 404", fn)


def t_patch_monitor_invalid_threshold(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token)
        r = client.patch(f"{BASE}/monitors/{m['id']}",
                         json={"threshold": 5},
                         headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("MON-14 PATCH invalid threshold → 400", fn)


def t_patch_monitor_below_plan_min(client):
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        # free min interval is 1440; create one valid monitor first
        r = client.post(f"{BASE}/monitors", json={
            "name": "freebee", "url": "https://e.com",
            "checkIntervalMinutes": FREE_MIN_INTERVAL,
        }, headers=auth_headers(token))
        assert r.status_code == 201, r.text
        mid = r.json()["monitor"]["id"]
        created_monitor_ids.append((token, mid))
        # now try to lower interval below plan min
        r2 = client.patch(f"{BASE}/monitors/{mid}",
                          json={"checkIntervalMinutes": 60},
                          headers=auth_headers(token))
        assert r2.status_code == 403, f"{r2.status_code} {r2.text}"
    check("MON-15 PATCH interval < plan min → 403", fn)


def t_patch_free_user_selector_blocked(client):
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        r = client.post(f"{BASE}/monitors", json={
            "name": "f1", "url": "https://e.com",
            "checkIntervalMinutes": FREE_MIN_INTERVAL,
        }, headers=auth_headers(token))
        assert r.status_code == 201
        mid = r.json()["monitor"]["id"]
        created_monitor_ids.append((token, mid))
        r2 = client.patch(f"{BASE}/monitors/{mid}",
                          json={"cssSelector": "h1"},
                          headers=auth_headers(token))
        assert r2.status_code == 403, f"{r2.status_code} {r2.text}"
    check("MON-16 PATCH free user adding cssSelector → 403", fn)


def t_delete_monitor_own(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token)
        r = client.delete(f"{BASE}/monitors/{m['id']}", headers=auth_headers(token))
        assert r.status_code == 200, r.text
        # confirm gone
        r2 = client.get(f"{BASE}/monitors/{m['id']}", headers=auth_headers(token))
        assert r2.status_code == 404
        # remove from cleanup list since it's already gone
        try:
            created_monitor_ids.remove((token, m["id"]))
        except ValueError:
            pass
    check("MON-17 DELETE /monitors/:id own → 200 + gone", fn)


def t_delete_monitor_other_user(client):
    def fn():
        token_a = login_pro(client)
        m = create_monitor(client, token_a)
        _, _, token_b = register_fresh_user(client)
        r = client.delete(f"{BASE}/monitors/{m['id']}", headers=auth_headers(token_b))
        assert r.status_code == 404, r.status_code
        # confirm still exists for owner
        r2 = client.get(f"{BASE}/monitors/{m['id']}", headers=auth_headers(token_a))
        assert r2.status_code == 200, "owner's monitor should still exist"
    check("MON-18 DELETE other user's monitor → 404 + intact", fn)


def t_delete_monitor_nonexistent(client):
    def fn():
        token = login_pro(client)
        r = client.delete(f"{BASE}/monitors/00000000-0000-0000-0000-000000000000",
                          headers=auth_headers(token))
        assert r.status_code == 404, r.status_code
    check("MON-19 DELETE nonexistent monitor → 404", fn)


def t_get_diffs_list(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token)
        r = client.get(f"{BASE}/monitors/{m['id']}/diffs", headers=auth_headers(token))
        assert r.status_code == 200, r.text
        assert isinstance(r.json()["diffs"], list)
    check("MON-20 GET /monitors/:id/diffs → 200", fn)


def t_get_diffs_other_user(client):
    def fn():
        token_a = login_pro(client)
        m = create_monitor(client, token_a)
        _, _, token_b = register_fresh_user(client)
        r = client.get(f"{BASE}/monitors/{m['id']}/diffs", headers=auth_headers(token_b))
        assert r.status_code == 404, r.status_code
    check("MON-21 GET other user's diffs → 404", fn)


# ─── 9. Manual check ────────────────────────────────────────────────────────

def t_manual_check_free_user(client):
    def fn():
        _, _, token_free = register_fresh_user(client, plan="free")
        # need a monitor to hit
        r = client.post(f"{BASE}/monitors", json={
            "name": "f", "url": "https://e.com",
            "checkIntervalMinutes": FREE_MIN_INTERVAL,
        }, headers=auth_headers(token_free))
        assert r.status_code == 201
        mid = r.json()["monitor"]["id"]
        created_monitor_ids.append((token_free, mid))
        r2 = client.post(f"{BASE}/monitors/{mid}/check", headers=auth_headers(token_free))
        assert r2.status_code == 403, f"free should be blocked: {r2.status_code} {r2.text}"
    check("MON-22 manual check (Free) → 403", fn)


def t_manual_check_pro_increments(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token)
        # snapshot current usage
        before = client.get(f"{BASE}/auth/me", headers=auth_headers(token)).json()["user"]["manualChecksUsedThisPeriod"]
        r = client.post(f"{BASE}/monitors/{m['id']}/check", headers=auth_headers(token))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert body["manualChecksUsedThisPeriod"] == before + 1
    check("MON-23 manual check (Pro) increments counter", fn)


def t_manual_check_other_user(client):
    def fn():
        token_a = login_pro(client)
        m = create_monitor(client, token_a)
        _, _, token_b = register_fresh_user(client)
        r = client.post(f"{BASE}/monitors/{m['id']}/check", headers=auth_headers(token_b))
        assert r.status_code == 404, r.status_code
    check("MON-24 manual check on other user's monitor → 404", fn)


# ─── 10. Dashboard ──────────────────────────────────────────────────────────

def t_dashboard_no_auth(client):
    def fn():
        r = client.get(f"{BASE}/dashboard/stats")
        assert r.status_code == 401, r.status_code
    check("DASH-01 GET /dashboard/stats no auth → 401", fn)


def t_dashboard_stats_shape(client):
    def fn():
        token = login_pro(client)
        m = create_monitor(client, token)
        r = client.get(f"{BASE}/dashboard/stats", headers=auth_headers(token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("activeMonitors"), int)
        assert body["activeMonitors"] >= 1, "should count at least the one we just made"
        assert isinstance(body.get("recentDiffs"), list)
    check("DASH-02 GET /dashboard/stats valid", fn)


# ─── 11. DOM Picker ─────────────────────────────────────────────────────────

def t_dom_picker_free_blocked(client):
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        r = client.post(f"{BASE}/dom-picker/test-selector",
                        json={"url": "https://example.com", "selector": "h1"},
                        headers=auth_headers(token))
        assert r.status_code == 403, f"{r.status_code} {r.text}"
    check("DOM-01 test-selector (Free) → 403", fn)


def t_dom_picker_pro_missing_fields(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/dom-picker/test-selector", json={},
                        headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("DOM-02 test-selector missing fields → 400", fn)


def t_dom_picker_screenshot_no_url(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/dom-picker/screenshot", json={},
                        headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("DOM-03 screenshot missing URL → 400", fn)


def t_dom_picker_resolve_missing_coords(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/dom-picker/resolve",
                        json={"url": "https://example.com"},
                        headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("DOM-04 resolve missing coords → 400", fn)


def t_dom_picker_no_auth(client):
    def fn():
        r = client.post(f"{BASE}/dom-picker/test-selector",
                        json={"url": "https://e.com", "selector": "h1"})
        assert r.status_code == 401, r.status_code
    check("DOM-05 test-selector no auth → 401", fn)


# ─── 12. Snapshots static ──────────────────────────────────────────────────

def t_snapshots_no_auth(client):
    def fn():
        r = client.get(f"{BASE}/snapshots/some-file.png")
        assert r.status_code == 401, f"{r.status_code} {r.text}"
    check("SNAP-01 GET /snapshots no auth → 401", fn)


# ─── 13. Site discovery ────────────────────────────────────────────────────

def _wait_for_discovery(client, token, job_id, timeout=60):
    """Poll until status is done or failed."""
    import time as _t
    start = _t.time()
    while _t.time() - start < timeout:
        _t.sleep(1)
        r = client.get(f"{BASE}/monitors/discover/{job_id}", headers=auth_headers(token))
        body = r.json()
        if body.get("status") in ("done", "failed"):
            return body
    return {"status": "timeout"}


def t_discover_no_auth(client):
    def fn():
        r = client.post(f"{BASE}/monitors/discover", json={"url": "https://example.com"})
        assert r.status_code == 401, r.status_code
    check("DISC-01 POST /discover no auth → 401", fn)


def t_discover_invalid_url(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/monitors/discover", json={"url": "not a url at all !!!"},
                        headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("DISC-02 POST /discover invalid URL → 400", fn)


def t_discover_missing_url(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/monitors/discover", json={}, headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("DISC-03 POST /discover missing URL → 400", fn)


def t_discover_unknown_job(client):
    def fn():
        token = login_pro(client)
        r = client.get(f"{BASE}/monitors/discover/nonexistent-job-id-zzz",
                       headers=auth_headers(token))
        assert r.status_code == 404, r.status_code
    check("DISC-04 GET /discover/:bogusJobId → 404", fn)


def t_discover_end_to_end(client):
    """Full happy path — enqueue, poll, get result with at least one URL."""
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/monitors/discover", json={"url": "https://example.com"},
                        headers=auth_headers(token))
        assert r.status_code == 202, f"{r.status_code} {r.text}"
        job_id = r.json()["jobId"]
        body = _wait_for_discovery(client, token, job_id, timeout=90)
        assert body.get("status") == "done", f"discovery did not complete: {body}"
        result = body["result"]
        assert isinstance(result["urls"], list)
        assert len(result["urls"]) >= 1
        assert result["hostname"] == "example.com"
        # The base URL itself should always be included
        assert any(u["url"].startswith("https://example.com") for u in result["urls"])
    check("DISC-05 discover end-to-end (example.com)", fn)


def t_discover_other_user_isolation(client):
    """User A's job is invisible to user B."""
    def fn():
        token_a = login_pro(client)
        r = client.post(f"{BASE}/monitors/discover", json={"url": "https://example.com"},
                        headers=auth_headers(token_a))
        assert r.status_code == 202
        job_id = r.json()["jobId"]
        _, _, token_b = register_fresh_user(client)
        r2 = client.get(f"{BASE}/monitors/discover/{job_id}", headers=auth_headers(token_b))
        assert r2.status_code == 404, f"cross-user job leak: {r2.status_code}"
    check("DISC-06 cross-user discovery isolation → 404", fn)


# ─── 14. Bulk monitor creation ─────────────────────────────────────────────

def t_bulk_no_urls(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/monitors/bulk", json={
            "urls": [], "shared": {"checkIntervalMinutes": PRO_MIN_INTERVAL},
        }, headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("BULK-01 empty urls array → 400", fn)


def t_bulk_missing_shared(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/monitors/bulk", json={
            "urls": ["https://example.com"],
        }, headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("BULK-02 missing shared settings → 400", fn)


def t_bulk_invalid_url(client):
    def fn():
        token = login_pro(client)
        r = client.post(f"{BASE}/monitors/bulk", json={
            "urls": ["https://example.com", "not a url"],
            "shared": {"checkIntervalMinutes": PRO_MIN_INTERVAL},
        }, headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("BULK-03 invalid URL in batch → 400", fn)


def t_bulk_below_plan_min(client):
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        r = client.post(f"{BASE}/monitors/bulk", json={
            "urls": ["https://e.com/a", "https://e.com/b"],
            "shared": {"checkIntervalMinutes": 60},  # below free's 1440
        }, headers=auth_headers(token))
        assert r.status_code == 403, f"{r.status_code} {r.text}"
    check("BULK-04 free user interval below min → 403", fn)


def t_bulk_over_quota(client):
    def fn():
        _, _, token = register_fresh_user(client, plan="free")
        # Free: max 5 monitors, 150 checks/month
        urls = [f"https://e.com/p{i}" for i in range(6)]
        r = client.post(f"{BASE}/monitors/bulk", json={
            "urls": urls,
            "shared": {"checkIntervalMinutes": FREE_MIN_INTERVAL},
        }, headers=auth_headers(token))
        assert r.status_code == 403, f"{r.status_code} {r.text}"
        # All-or-nothing: zero monitors should have been created
        r2 = client.get(f"{BASE}/monitors", headers=auth_headers(token))
        assert len(r2.json()["monitors"]) == 0, "partial create on quota fail!"
    check("BULK-05 over-quota batch → 403 + zero created", fn)


def t_bulk_success_no_group(client):
    def fn():
        token = login_pro(client)
        urls = [f"https://example.com/bulk-{uuid.uuid4().hex[:6]}-{i}" for i in range(3)]
        r = client.post(f"{BASE}/monitors/bulk", json={
            "urls": urls,
            "shared": {"checkIntervalMinutes": PRO_MIN_INTERVAL, "threshold": 0.05},
        }, headers=auth_headers(token))
        assert r.status_code == 201, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["created"] == 3
        assert body["groupId"] is None
        for m in body["monitors"]:
            created_monitor_ids.append((token, m["id"]))
    check("BULK-06 success without group", fn)


def t_bulk_success_with_group(client):
    def fn():
        token = login_pro(client)
        urls = [f"https://example.com/group-{uuid.uuid4().hex[:6]}-{i}" for i in range(3)]
        gname = f"TestGroup-{uuid.uuid4().hex[:6]}"
        r = client.post(f"{BASE}/monitors/bulk", json={
            "urls": urls, "groupName": gname,
            "shared": {"checkIntervalMinutes": PRO_MIN_INTERVAL},
        }, headers=auth_headers(token))
        assert r.status_code == 201, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["created"] == 3
        assert body["groupId"] is not None
        assert body["groupName"] == gname
        created_group_ids.append((token, body["groupId"]))
        # All members should reference the group
        for m in body["monitors"]:
            assert m["groupId"] == body["groupId"]
    check("BULK-07 success with group + linked members", fn)


# ─── 15. Monitor groups ───────────────────────────────────────────────────

def t_groups_no_auth(client):
    def fn():
        r = client.get(f"{BASE}/monitor-groups")
        assert r.status_code == 401, r.status_code
    check("GRP-01 GET /monitor-groups no auth → 401", fn)


def t_groups_list_empty(client):
    def fn():
        _, _, token = register_fresh_user(client)
        r = client.get(f"{BASE}/monitor-groups", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["groups"] == []
    check("GRP-02 GET /monitor-groups empty for new user", fn)


def _create_group_via_bulk(client, token, count=2):
    urls = [f"https://example.com/grp-{uuid.uuid4().hex[:6]}-{i}" for i in range(count)]
    r = client.post(f"{BASE}/monitors/bulk", json={
        "urls": urls,
        "groupName": f"Grp-{uuid.uuid4().hex[:6]}",
        "shared": {"checkIntervalMinutes": PRO_MIN_INTERVAL},
    }, headers=auth_headers(token))
    assert r.status_code == 201, r.text
    body = r.json()
    created_group_ids.append((token, body["groupId"]))
    for m in body["monitors"]:
        created_monitor_ids.append((token, m["id"]))
    return body


def t_groups_list_with_members(client):
    def fn():
        token = login_pro(client)
        bulk = _create_group_via_bulk(client, token, count=3)
        r = client.get(f"{BASE}/monitor-groups", headers=auth_headers(token))
        assert r.status_code == 200
        match = [g for g in r.json()["groups"] if g["id"] == bulk["groupId"]]
        assert len(match) == 1
        g = match[0]
        assert g["memberCount"] == 3
        assert g["activeCount"] == 3
    check("GRP-03 list shows member + active counts", fn)


def t_group_get_members(client):
    def fn():
        token = login_pro(client)
        bulk = _create_group_via_bulk(client, token, count=2)
        r = client.get(f"{BASE}/monitor-groups/{bulk['groupId']}", headers=auth_headers(token))
        assert r.status_code == 200
        body = r.json()
        assert body["group"]["id"] == bulk["groupId"]
        assert len(body["monitors"]) == 2
    check("GRP-04 GET /:id with members", fn)


def t_group_other_user(client):
    def fn():
        token_a = login_pro(client)
        bulk = _create_group_via_bulk(client, token_a, count=2)
        _, _, token_b = register_fresh_user(client)
        r = client.get(f"{BASE}/monitor-groups/{bulk['groupId']}", headers=auth_headers(token_b))
        assert r.status_code == 404, r.status_code
    check("GRP-05 cross-user group → 404", fn)


def t_group_rename(client):
    def fn():
        token = login_pro(client)
        bulk = _create_group_via_bulk(client, token)
        new_name = f"Renamed-{uuid.uuid4().hex[:6]}"
        r = client.patch(f"{BASE}/monitor-groups/{bulk['groupId']}",
                         json={"name": new_name}, headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["group"]["name"] == new_name
    check("GRP-06 rename group", fn)


def t_group_pause_all(client):
    def fn():
        token = login_pro(client)
        bulk = _create_group_via_bulk(client, token, count=3)
        # Pause
        r = client.post(f"{BASE}/monitor-groups/{bulk['groupId']}/pause",
                        json={"isActive": False}, headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["updated"] == 3
        # Verify all paused
        r = client.get(f"{BASE}/monitor-groups/{bulk['groupId']}", headers=auth_headers(token))
        assert all(not m["isActive"] for m in r.json()["monitors"])
        # Resume
        r = client.post(f"{BASE}/monitor-groups/{bulk['groupId']}/pause",
                        json={"isActive": True}, headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["updated"] == 3
    check("GRP-07 pause/resume all in group", fn)


def t_group_pause_invalid_payload(client):
    def fn():
        token = login_pro(client)
        bulk = _create_group_via_bulk(client, token)
        r = client.post(f"{BASE}/monitor-groups/{bulk['groupId']}/pause",
                        json={}, headers=auth_headers(token))
        assert r.status_code == 400, r.status_code
    check("GRP-08 pause without isActive → 400", fn)


def t_group_delete_cascade(client):
    def fn():
        token = login_pro(client)
        bulk = _create_group_via_bulk(client, token, count=3)
        gid = bulk["groupId"]
        member_ids = [m["id"] for m in bulk["monitors"]]
        # Delete cascading
        r = client.delete(f"{BASE}/monitor-groups/{gid}", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["deletedMonitors"] == 3
        # All members should be gone
        r = client.get(f"{BASE}/monitors", headers=auth_headers(token))
        remaining = {m["id"] for m in r.json()["monitors"]}
        for mid in member_ids:
            assert mid not in remaining, f"monitor {mid} survived cascade delete"
        # Group should be gone
        r = client.get(f"{BASE}/monitor-groups/{gid}", headers=auth_headers(token))
        assert r.status_code == 404
        # Cleanup tracking
        created_group_ids[:] = [(t, g) for t, g in created_group_ids if g != gid]
        created_monitor_ids[:] = [(t, m) for t, m in created_monitor_ids if m not in member_ids]
    check("GRP-09 DELETE cascades to all members", fn)


def t_group_delete_keep_monitors(client):
    """?keepMonitors=true detaches members instead of deleting them."""
    def fn():
        token = login_pro(client)
        bulk = _create_group_via_bulk(client, token, count=2)
        gid = bulk["groupId"]
        member_ids = [m["id"] for m in bulk["monitors"]]
        r = client.delete(f"{BASE}/monitor-groups/{gid}?keepMonitors=true",
                          headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["deletedMonitors"] == 0
        # Members should still exist but with no group
        r = client.get(f"{BASE}/monitors", headers=auth_headers(token))
        for m in r.json()["monitors"]:
            if m["id"] in member_ids:
                assert m.get("groupId") is None, f"detach failed for {m['id']}"
        # Cleanup tracking
        created_group_ids[:] = [(t, g) for t, g in created_group_ids if g != gid]
    check("GRP-10 DELETE ?keepMonitors=true detaches", fn)


# ─── runner ─────────────────────────────────────────────────────────────────

def pre_clean_pro_user(client):
    """Wipe ALL the Pro user's monitors and groups before bulk/group tests so
    each run starts from zero and doesn't bump into the 50-monitor cap."""
    try:
        token = login_pro(client)
        # Delete groups (cascades members)
        r = client.get(f"{BASE}/monitor-groups", headers=auth_headers(token))
        for g in r.json().get("groups", []):
            client.delete(f"{BASE}/monitor-groups/{g['id']}", headers=auth_headers(token))
        # Delete any remaining ungrouped monitors
        r = client.get(f"{BASE}/monitors", headers=auth_headers(token))
        for m in r.json().get("monitors", []):
            client.delete(f"{BASE}/monitors/{m['id']}", headers=auth_headers(token))
    except Exception:
        pass


def cleanup(client):
    """Best-effort cleanup. Order matters:
    1) Groups first (cascades their members) — fewer deletes.
    2) Stray ungrouped monitors next.
    3) Test users last (cascades anything we missed for that user)."""
    groups_deleted = 0
    for token, gid in created_group_ids:
        try:
            r = client.delete(f"{BASE}/monitor-groups/{gid}", headers=auth_headers(token))
            if r.status_code == 200:
                groups_deleted += 1
        except Exception:
            pass
    monitors_deleted = 0
    for token, mid in created_monitor_ids:
        try:
            r = client.delete(f"{BASE}/monitors/{mid}", headers=auth_headers(token))
            if r.status_code == 200:
                monitors_deleted += 1
        except Exception:
            pass
    users_deleted = 0
    for token in created_user_tokens:
        try:
            r = client.delete(f"{BASE}/auth/me", headers=auth_headers(token))
            if r.status_code == 200:
                users_deleted += 1
        except Exception:
            pass
    if groups_deleted or monitors_deleted or users_deleted:
        print(f"\n  🧹 cleaned up {groups_deleted} groups, {monitors_deleted} monitors, {users_deleted} test users")


def main():
    print("\n" + "=" * 60)
    print("  SonarDiff Backend E2E / Integration Test Suite")
    print(f"  → {BASE}")
    print("=" * 60)

    suite = [
        ("HEALTH",  [t_healthz]),
        ("AUTH",    [t_register_valid, t_register_pro_plan, t_register_missing_fields,
                     t_register_short_password, t_register_duplicate_email,
                     t_register_email_normalization,
                     t_login_valid, t_login_wrong_password, t_login_unknown_email, t_login_missing_fields,
                     t_me_no_auth, t_me_malformed_header, t_me_bad_token, t_me_valid,
                     t_patch_me_name, t_patch_me_short_password, t_patch_me_password_then_login,
                     t_api_token_generate,
                     t_logout_invalidates_session, t_delete_me_cascade]),
        ("MONITOR", [t_monitors_no_auth, t_monitors_list_empty,
                     t_create_monitor_pro, t_create_monitor_missing_fields,
                     t_create_monitor_below_plan_min, t_create_monitor_invalid_threshold,
                     t_create_monitor_free_no_selector, t_create_monitor_quota_exceeded,
                     t_get_monitor_own, t_get_monitor_other_user, t_get_monitor_nonexistent,
                     t_patch_monitor_own, t_patch_monitor_other_user,
                     t_patch_monitor_invalid_threshold, t_patch_monitor_below_plan_min,
                     t_patch_free_user_selector_blocked,
                     t_delete_monitor_own, t_delete_monitor_other_user, t_delete_monitor_nonexistent,
                     t_get_diffs_list, t_get_diffs_other_user,
                     t_manual_check_free_user, t_manual_check_pro_increments,
                     t_manual_check_other_user]),
        ("DASH",    [t_dashboard_no_auth, t_dashboard_stats_shape]),
        ("DOM",     [t_dom_picker_free_blocked, t_dom_picker_pro_missing_fields,
                     t_dom_picker_screenshot_no_url, t_dom_picker_resolve_missing_coords,
                     t_dom_picker_no_auth]),
        ("SNAP",    [t_snapshots_no_auth]),
        ("DISC",    [t_discover_no_auth, t_discover_invalid_url, t_discover_missing_url,
                     t_discover_unknown_job, t_discover_end_to_end,
                     t_discover_other_user_isolation]),
        ("BULK",    [t_bulk_no_urls, t_bulk_missing_shared, t_bulk_invalid_url,
                     t_bulk_below_plan_min, t_bulk_over_quota,
                     t_bulk_success_no_group, t_bulk_success_with_group]),
        ("GRP",     [t_groups_no_auth, t_groups_list_empty, t_groups_list_with_members,
                     t_group_get_members, t_group_other_user, t_group_rename,
                     t_group_pause_all, t_group_pause_invalid_payload,
                     t_group_delete_cascade, t_group_delete_keep_monitors]),
    ]

    with httpx.Client(timeout=30.0) as client:
        # Wipe Pro user monitors/groups so MONITOR/BULK/GRP tests start clean
        pre_clean_pro_user(client)
        for group_name, tests in suite:
            print(f"\n── {group_name} " + "─" * (54 - len(group_name)))
            for t in tests:
                t(client)

        cleanup(client)

    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    print("\n" + "=" * 60)
    print(f"  Results: {passed}/{total} passed  ({failed} failed)")
    print("=" * 60)
    if failed:
        print("\nFailed tests:")
        for r in results:
            if not r["passed"]:
                print(f"  ❌ {r['name']}")
                print(f"     {r['detail']}")
    print()
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
