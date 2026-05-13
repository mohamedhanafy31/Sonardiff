import requests
import uuid

BASE_URL = "http://localhost:3001"
REGISTER_URL = f"{BASE_URL}/api/auth/register"
DELETE_ACCOUNT_URL = f"{BASE_URL}/api/auth/me"
CREATE_MONITOR_URL = f"{BASE_URL}/api/monitors"

def test_postapimonitorsvalidateandrejectinvaliddata():
    # Generate unique email for registration
    unique_email = f"testuser_{uuid.uuid4()}@example.com"
    password = "StrongPass123!"
    name = "Test User"
    plan = "free"  # Use free plan to test threshold and interval limits
    
    # Register user
    register_payload = {
        "email": unique_email,
        "password": password,
        "name": name,
        "plan": plan
    }
    r = requests.post(REGISTER_URL, json=register_payload, timeout=30)
    assert r.status_code == 201, f"User registration failed: {r.text}"
    resp_json = r.json()
    token = resp_json.get("token")
    assert token and isinstance(token, str)
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    invalid_monitors = [
        # Out-of-range threshold - less than 0
        {
            "name": "Out-of-Range Threshold Low",
            "url": "http://valid-url.com",
            "checkIntervalMinutes": 1440,
            "threshold": -0.1
        },
        # Out-of-range threshold - greater than 1
        {
            "name": "Out-of-Range Threshold High",
            "url": "http://valid-url.com",
            "checkIntervalMinutes": 1440,
            "threshold": 1.5
        }
    ]
    
    try:
        for monitor_data in invalid_monitors:
            response = requests.post(CREATE_MONITOR_URL, json=monitor_data, headers=headers, timeout=30)
            assert response.status_code == 400, (
                f"Expected 400 for invalid monitor data but got {response.status_code} for payload: {monitor_data}, response: {response.text}"
            )
            resp_json = response.json()
            error_msg = resp_json.get("error")
            assert error_msg and isinstance(error_msg, str) and len(error_msg) > 0, f"Missing or invalid error message in response: {response.text}"
    finally:
        # Clean up: delete user account to cascade delete user data including monitors if any created
        del_resp = requests.delete(DELETE_ACCOUNT_URL, headers=headers, timeout=30)
        assert del_resp.status_code == 200, f"Failed to delete user account: {del_resp.text}"
        del_json = del_resp.json()
        assert del_json.get("success") is True

test_postapimonitorsvalidateandrejectinvaliddata()
