import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_api_monitors_validate_and_create_monitor():
    # Register a new user to get a token for authentication
    register_url = f"{BASE_URL}/api/auth/register"
    unique_email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
    register_payload = {
        "email": unique_email,
        "password": "StrongPassw0rd!",
        "name": "Test User",
        "plan": "pro"
    }

    token = None
    monitor_id = None
    try:
        r = requests.post(register_url, json=register_payload, timeout=TIMEOUT)
        assert r.status_code == 201, f"Registration failed with status {r.status_code}, response: {r.text}"
        body = r.json()
        assert "token" in body and "user" in body, "Missing token or user in registration response"
        token = body["token"]
        headers = {
            "Authorization": f"Bearer {token}"
        }

        # Create a new monitor with valid data including Pro-only fields (cssSelector, exclusionRules)
        monitors_url = f"{BASE_URL}/api/monitors"
        monitor_payload = {
            "name": "Test Monitor",
            "url": "https://example.com",
            "checkIntervalMinutes": 60,
            "threshold": 0.05,
            "cssSelector": ".pro-only-class",
            "exclusionRules": ["#ads", ".popup"]
        }

        r = requests.post(monitors_url, json=monitor_payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Creating monitor failed with status {r.status_code}, response: {r.text}"
        data = r.json()
        assert "monitor" in data and isinstance(data["monitor"], dict), "Response missing monitor object"
        monitor = data["monitor"]

        # Validate monitor fields
        assert monitor.get("name") == monitor_payload["name"], "Monitor name mismatch"
        assert monitor.get("url") == monitor_payload["url"], "Monitor url mismatch"
        assert monitor.get("checkIntervalMinutes") == monitor_payload["checkIntervalMinutes"], "Interval mismatch"
        # threshold might be defaulted if not accepted, so check close match
        assert abs(monitor.get("threshold", 0) - monitor_payload["threshold"]) < 1e-6, "Threshold mismatch"

        # Pro-only fields should be present in monitor if plan is pro
        # They may have different property names or be missing, we check if present and match
        if "cssSelector" in monitor_payload:
            assert monitor.get("cssSelector") == monitor_payload["cssSelector"], "cssSelector mismatch"
        if "exclusionRules" in monitor_payload:
            assert monitor.get("exclusionRules") == monitor_payload["exclusionRules"], "exclusionRules mismatch"

        monitor_id = monitor.get("id")
        assert monitor_id is not None, "Monitor ID missing from response"

    finally:
        # Cleanup: delete the created monitor and user account if token and monitor_id exist
        if token:
            headers = {"Authorization": f"Bearer {token}"}
            if monitor_id:
                try:
                    r = requests.delete(f"{BASE_URL}/api/monitors/{monitor_id}", headers=headers, timeout=TIMEOUT)
                    # 200 expected or 404 if already deleted
                    assert r.status_code in (200, 404)
                except Exception:
                    pass
            try:
                # Delete user account
                r = requests.delete(f"{BASE_URL}/api/auth/me", headers=headers, timeout=TIMEOUT)
                assert r.status_code == 200
            except Exception:
                pass

test_post_api_monitors_validate_and_create_monitor()
