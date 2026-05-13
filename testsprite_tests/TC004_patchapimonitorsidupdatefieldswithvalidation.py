import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def patchapimonitorsidupdatefieldswithvalidation():
    # Register a new user (Pro plan)
    unique_email = f"testuser-{uuid.uuid4()}@example.com"
    register_payload = {
        "email": unique_email,
        "password": "TestPass123!",
        "name": "Test User",
        "plan": "pro"
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload, timeout=TIMEOUT)
    assert r.status_code == 201, f"Registration failed: {r.text}"
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    monitor_id = None

    try:
        # Create a new monitor with valid fields on Pro plan
        create_monitor_payload = {
            "name": "Initial Monitor Name",
            "url": "https://example.com",
            "checkIntervalMinutes": 60,
            "threshold": 0.05,
            "cssSelector": "body",
            "exclusionRules": ["#ads"]
        }
        r = requests.post(f"{BASE_URL}/api/monitors", json=create_monitor_payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Monitor creation failed: {r.text}"
        monitor = r.json()["monitor"]
        monitor_id = monitor["id"]

        # Prepare update payload including all fields with proper validation
        update_payload = {
            "name": "Updated Monitor Name",
            "url": "https://updated-example.com",
            "checkIntervalMinutes": 120,
            "isActive": False,
            "threshold": 0.1,
            "cssSelector": "div.content",
            "exclusionRules": ["#popup", ".ads-banner"]
        }
        # PATCH update monitor
        r = requests.patch(f"{BASE_URL}/api/monitors/{monitor_id}", json=update_payload, headers=headers, timeout=TIMEOUT)
        # Should be 200 OK with updated monitor or error codes on failures
        assert r.status_code == 200, f"Monitor update failed: {r.text}"
        updated_monitor = r.json()["monitor"]

        # Validate that the returned monitor has the updated fields
        assert updated_monitor["name"] == update_payload["name"], "Name not updated correctly"
        assert updated_monitor["url"] == update_payload["url"], "URL not updated correctly"
        assert updated_monitor["checkIntervalMinutes"] == update_payload["checkIntervalMinutes"], "checkIntervalMinutes not updated correctly"
        assert updated_monitor["isActive"] == update_payload["isActive"], "isActive not updated correctly"
        assert abs(updated_monitor["threshold"] - update_payload["threshold"]) < 1e-6, "threshold not updated correctly"
        # Pro-only fields
        assert updated_monitor.get("cssSelector") == update_payload["cssSelector"], "cssSelector not updated correctly"
        assert updated_monitor.get("exclusionRules") == update_payload["exclusionRules"], "exclusionRules not updated correctly"

        # Test invalid threshold (below 0)
        invalid_threshold_payload = {"threshold": -0.1}
        r = requests.patch(f"{BASE_URL}/api/monitors/{monitor_id}", json=invalid_threshold_payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 400, "Invalid threshold <0 was not rejected"
        assert "error" in r.json(), "Error message missing for invalid threshold"

        # Test invalid threshold (above 1)
        invalid_threshold_payload = {"threshold": 1.5}
        r = requests.patch(f"{BASE_URL}/api/monitors/{monitor_id}", json=invalid_threshold_payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 400, "Invalid threshold >1 was not rejected"
        assert "error" in r.json(), "Error message missing for invalid threshold"

        # Test Free plan minimum checkIntervalMinutes (should not be allowed for Pro monitor update)
        # Create a Free plan user to test interval restriction
        free_email = f"freeuser-{uuid.uuid4()}@example.com"
        r_free = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": free_email,
            "password": "TestPass123!",
            "name": "Free User",
            "plan": "free"
        }, timeout=TIMEOUT)
        assert r_free.status_code == 201, f"Free user registration failed: {r_free.text}"
        free_token = r_free.json()["token"]
        free_headers = {"Authorization": f"Bearer {free_token}"}

        # Create a Free plan monitor
        r = requests.post(f"{BASE_URL}/api/monitors", json={
            "name": "Free Monitor",
            "url": "https://free.example.com",
            "checkIntervalMinutes": 1440,
        }, headers=free_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Free plan monitor creation failed: {r.text}"
        free_monitor = r.json()["monitor"]
        free_monitor_id = free_monitor["id"]

        # Attempt to update Free monitor checkIntervalMinutes below 1440
        invalid_interval_payload = {"checkIntervalMinutes": 60}
        r = requests.patch(f"{BASE_URL}/api/monitors/{free_monitor_id}", json=invalid_interval_payload, headers=free_headers, timeout=TIMEOUT)
        assert r.status_code == 400 or r.status_code == 403, "Free plan minimum checkIntervalMinutes update to below 1440 not rejected"
        assert "error" in r.json(), "Error message missing for invalid interval update"

        # Clean up Free plan monitor and user
        requests.delete(f"{BASE_URL}/api/monitors/{free_monitor_id}", headers=free_headers, timeout=TIMEOUT)
        requests.delete(f"{BASE_URL}/api/auth/me", headers=free_headers, timeout=TIMEOUT)

    finally:
        # Cleanup: delete monitor and user
        if monitor_id:
            requests.delete(f"{BASE_URL}/api/monitors/{monitor_id}", headers=headers, timeout=TIMEOUT)
        requests.delete(f"{BASE_URL}/api/auth/me", headers=headers, timeout=TIMEOUT)

patchapimonitorsidupdatefieldswithvalidation()