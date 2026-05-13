import requests

BASE_URL = "http://localhost:3001"
REGISTER_URL = f"{BASE_URL}/api/auth/register"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
MONITORS_URL = f"{BASE_URL}/api/monitors"

TEST_USER = {
    "email": "testuser_tc009@example.com",
    "password": "TestPassw0rd!",
    "name": "Test User TC009",
    "plan": "pro"
}

MONITOR_PAYLOAD = {
    "name": "TC009 Test Monitor",
    "url": "https://example.com/",
    "checkIntervalMinutes": 60,
    "threshold": 0.05
}

TIMEOUT = 30

def test_get_api_monitors_id_diffs_list_diffs_history():
    # Register user
    resp = requests.post(REGISTER_URL, json=TEST_USER, timeout=TIMEOUT)
    if resp.status_code == 409:
        # Email already registered, login instead
        resp = requests.post(LOGIN_URL, json={"email": TEST_USER["email"], "password": TEST_USER["password"]}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Login failed with status code {resp.status_code} and body {resp.text}"
    else:
        assert resp.status_code == 201, f"Registration failed with status code {resp.status_code} and body {resp.text}"
    token = resp.json().get("token")
    assert token, "No token returned from auth"

    headers = {"Authorization": f"Bearer {token}"}

    monitor_id = None
    try:
        # Create a new monitor to test on
        create_resp = requests.post(MONITORS_URL, headers=headers, json=MONITOR_PAYLOAD, timeout=TIMEOUT)
        assert create_resp.status_code == 201, f"Create monitor failed with status code {create_resp.status_code} and body {create_resp.text}"
        monitor = create_resp.json().get("monitor")
        assert monitor and "id" in monitor, "Monitor object missing or id not present"
        monitor_id = monitor["id"]

        # Get diffs list for existing monitor
        diffs_resp = requests.get(f"{MONITORS_URL}/{monitor_id}/diffs", headers=headers, timeout=TIMEOUT)
        # Should succeed with 200 and diffs array (can be empty)
        assert diffs_resp.status_code == 200, f"GET diffs failed with status code {diffs_resp.status_code} and body {diffs_resp.text}"
        diffs_json = diffs_resp.json()
        assert "diffs" in diffs_json and isinstance(diffs_json["diffs"], list), "Response missing 'diffs' list"

        # Get diffs list for non-existent monitor id (use a large unlikely id)
        invalid_id = "00000000-0000-0000-0000-000000000000"
        notfound_resp = requests.get(f"{MONITORS_URL}/{invalid_id}/diffs", headers=headers, timeout=TIMEOUT)
        assert notfound_resp.status_code == 404, f"GET diffs for non-existent monitor should be 404 but got {notfound_resp.status_code}"
        error_json = notfound_resp.json()
        assert error_json.get("error") == "Monitor not found", "Expected 'Monitor not found' error message"

    finally:
        # Cleanup delete monitor if created
        if monitor_id:
            del_resp = requests.delete(f"{MONITORS_URL}/{monitor_id}", headers=headers, timeout=TIMEOUT)
            # Deletion may theoretically fail if already deleted, but assert for success typical path
            assert del_resp.status_code == 200, f"Cleanup delete monitor failed with status code {del_resp.status_code} and body {del_resp.text}"

test_get_api_monitors_id_diffs_list_diffs_history()
