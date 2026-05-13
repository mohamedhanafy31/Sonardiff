import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_postapimonitorsrejectprofieldsforfreeplan():
    # Register a new user with Free plan to get token
    register_data = {
        "email": "testfreeplanprofields@example.com",
        "password": "StrongPass123",
        "name": "Free Plan User",
        "plan": "free"
    }
    try:
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json=register_data, timeout=TIMEOUT)
        assert register_resp.status_code == 201, f"Registration failed: {register_resp.text}"
        token = register_resp.json().get("token")
        assert token, "No token returned on registration"

        headers = {
            "Authorization": f"Bearer {token}"
        }

        # Attempt to create a monitor with Pro-only fields on Free plan user
        monitor_data = {
            "name": "Test Monitor Pro Fields",
            "url": "https://example.com",
            "checkIntervalMinutes": 10,
            "cssSelector": ".pro-only-selector",
            "exclusionRules": [".ad-banner"],
            "threshold": 0.01
        }
        create_resp = requests.post(f"{BASE_URL}/api/monitors", json=monitor_data, headers=headers, timeout=TIMEOUT)
        # Expecting 403 Forbidden with error message
        assert create_resp.status_code == 403, f"Expected 403, got {create_resp.status_code} with body: {create_resp.text}"
        resp_json = create_resp.json()
        assert "error" in resp_json and isinstance(resp_json["error"], str) and resp_json["error"], \
            f"Expected error message in response body, got: {resp_json}"

    finally:
        # Cleanup: delete the user if created
        if 'token' in locals():
            # Delete user account to clean up
            del_headers = {
                "Authorization": f"Bearer {token}"
            }
            requests.delete(f"{BASE_URL}/api/auth/me", headers=del_headers, timeout=TIMEOUT)


test_postapimonitorsrejectprofieldsforfreeplan()