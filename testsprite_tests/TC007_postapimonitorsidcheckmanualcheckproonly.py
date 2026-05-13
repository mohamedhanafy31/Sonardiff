import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_api_monitors_id_check_manual_check_pro_only():
    # Register a new Pro user
    user_email = f"prouser_{uuid.uuid4()}@example.com"
    user_password = "strongpassword"
    register_payload = {
        "email": user_email,
        "password": user_password,
        "name": "Pro User",
        "plan": "pro"
    }
    headers = {
        "Content-Type": "application/json"
    }
    # Register user
    resp = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=register_payload,
        headers=headers,
        timeout=TIMEOUT
    )
    assert resp.status_code == 201, f"Unexpected register status code: {resp.status_code}, resp: {resp.text}"
    token = resp.json().get("token")
    assert token, "No token received on registration"

    auth_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    monitor_id = None

    try:
        # Create a new Pro plan monitor with allowed minimal checkIntervalMinutes (60)
        monitor_payload = {
            "name": "Test Pro Monitor for Manual Check",
            "url": "https://example.com",
            "checkIntervalMinutes": 60,
            "cssSelector": "body",  # Pro-only field
            "threshold": 0.01
        }
        resp = requests.post(
            f"{BASE_URL}/api/monitors",
            json=monitor_payload,
            headers=auth_headers,
            timeout=TIMEOUT
        )
        assert resp.status_code == 201, f"Failed to create Pro monitor: {resp.status_code}, {resp.text}"
        monitor = resp.json().get("monitor")
        assert monitor, "No monitor object returned"
        monitor_id = monitor.get("id")
        assert monitor_id, "Created monitor has no ID"
        # Verify the monitor's plan requirements are respected in response (just extra safety)
        assert monitor.get("checkIntervalMinutes") >= 60, "Monitor checkIntervalMinutes is less than 60 for Pro plan"

        # Trigger immediate manual check on the Pro monitor
        resp = requests.post(
            f"{BASE_URL}/api/monitors/{monitor_id}/check",
            headers=auth_headers,
            timeout=TIMEOUT
        )
        assert resp.status_code == 200, f"Manual check trigger failed with status {resp.status_code}, {resp.text}"
        json_resp = resp.json()
        # Validate response keys and values
        assert json_resp.get("success") is True, "Response success field is not true"
        assert "manualChecksUsedThisPeriod" in json_resp, "manualChecksUsedThisPeriod missing in response"
        manual_checks_used = json_resp.get("manualChecksUsedThisPeriod")
        assert isinstance(manual_checks_used, int) and manual_checks_used > 0, "manualChecksUsedThisPeriod is not a positive integer"

    finally:
        # Clean up: Delete monitor if created
        if monitor_id:
            del_resp = requests.delete(
                f"{BASE_URL}/api/monitors/{monitor_id}",
                headers=auth_headers,
                timeout=TIMEOUT
            )
            # Accept both 200 or 404 in case monitor already gone
            assert del_resp.status_code in (200, 404), f"Failed to delete monitor: {del_resp.status_code}, {del_resp.text}"

        # Clean up: Delete user account
        del_user_resp = requests.delete(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers,
            timeout=TIMEOUT
        )
        assert del_user_resp.status_code == 200, f"Failed to delete user account: {del_user_resp.status_code}, {del_user_resp.text}"

test_post_api_monitors_id_check_manual_check_pro_only()