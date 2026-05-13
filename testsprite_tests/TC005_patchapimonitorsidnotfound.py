import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_patchapimonitorsidnotfound():
    # Register a new user to get a valid token
    register_payload = {
        "email": "user_tc005@example.com",
        "password": "Password123!",
        "name": "Test User TC005"
    }
    try:
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload, timeout=TIMEOUT)
        assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
        reg_data = reg_resp.json()
        token = reg_data.get("token")
        assert token, "No token in registration response"

        headers = {
            "Authorization": f"Bearer {token}"
        }

        # Attempt to patch a non-existent monitor ID
        non_existent_monitor_id = "00000000-0000-0000-0000-000000000000"
        patch_payload = {
            "name": "Updated Name",
            "url": "https://example.com/updated",
            "checkIntervalMinutes": 15,
            "threshold": 0.05
        }
        patch_resp = requests.patch(
            f"{BASE_URL}/api/monitors/{non_existent_monitor_id}",
            json=patch_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert patch_resp.status_code == 404, f"Expected 404 not found, got {patch_resp.status_code}"
        patch_data = patch_resp.json()
        assert patch_data.get("error") == "Monitor not found", f"Unexpected error message: {patch_data}"

    finally:
        # Cleanup: delete the registered user account
        if 'token' in locals():
            requests.delete(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT)

test_patchapimonitorsidnotfound()