import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_api_monitors_id_check_manual_check_for_free_plan():
    email = f"{uuid.uuid4()}@example.com"
    password = "Password123!"
    name = "Test User Free Plan"

    headers = {"Content-Type": "application/json"}

    # Register user with free plan
    register_payload = {
        "email": email,
        "password": password,
        "name": name,
        "plan": "free"
    }
    try:
        r = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Expected 201 Created, got {r.status_code}"
        token = r.json().get("token")
        user = r.json().get("user")
        assert token, "No token received on register"
        assert user, "No user object received on register"

        auth_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # Create a new monitor with checkIntervalMinutes = 1440 (minimum for Free plan)
        monitor_payload = {
            "name": "Free Plan Monitor",
            "url": "https://example.com",
            "checkIntervalMinutes": 1440
        }
        r = requests.post(f"{BASE_URL}/api/monitors", json=monitor_payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Expected 201 Created for monitor, got {r.status_code}"
        monitor = r.json().get("monitor")
        assert monitor and "id" in monitor, "Monitor creation failed or no id returned"
        monitor_id = monitor["id"]

        # Attempt to trigger manual check on Free plan monitor
        r = requests.post(f"{BASE_URL}/api/monitors/{monitor_id}/check", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 403, f"Expected 403 Forbidden for manual check on free plan, got {r.status_code}"
        resp_json = r.json()
        assert "error" in resp_json and isinstance(resp_json["error"], str) and len(resp_json["error"]) > 0, "Expected error message in response"

    finally:
        # Cleanup: delete monitor and user
        if 'monitor_id' in locals():
            try:
                requests.delete(f"{BASE_URL}/api/monitors/{monitor_id}", headers=auth_headers, timeout=TIMEOUT)
            except Exception:
                pass
        if 'token' in locals():
            try:
                requests.delete(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=TIMEOUT)
            except Exception:
                pass

test_post_api_monitors_id_check_manual_check_for_free_plan()