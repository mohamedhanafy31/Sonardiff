import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_deleteapimonitorsiddeletesmonitorandrelateddata():
    # Helper function to register a user and return token and user id
    def register_user():
        email = f"user-{uuid.uuid4()}@example.com"
        password = "strongpassword"
        name = "Test User"
        payload = {"email": email, "password": password, "name": name, "plan": "free"}
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=TIMEOUT)
        assert r.status_code == 201, f"Registration failed: {r.text}"
        data = r.json()
        token = data.get("token")
        user = data.get("user")
        assert token and user and "id" in user
        return token, user["id"]

    # Helper function to create a monitor, returns monitor object
    def create_monitor(token):
        # free plan minimum checkIntervalMinutes is 1440
        monitor_payload = {
            "name": "Test Monitor",
            "url": "http://example.com",
            "checkIntervalMinutes": 1440,
            "threshold": 0.01
        }
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.post(f"{BASE_URL}/api/monitors", json=monitor_payload, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Monitor creation failed: {r.text}"
        data = r.json()
        monitor = data.get("monitor")
        assert monitor and "id" in monitor
        return monitor

    # Helper function to delete user account
    def delete_user(token):
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.delete(f"{BASE_URL}/api/auth/me", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        resp = r.json()
        assert resp.get("success") is True

    token, user_id = register_user()
    monitor = None

    try:
        monitor = create_monitor(token)
        monitor_id = monitor["id"]
        headers = {"Authorization": f"Bearer {token}"}
        # Delete the monitor
        r = requests.delete(f"{BASE_URL}/api/monitors/{monitor_id}", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Expected 200 on delete, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("success") is True

        # Verify monitor is gone - should get 404
        r_get = requests.get(f"{BASE_URL}/api/monitors/{monitor_id}", headers=headers, timeout=TIMEOUT)
        assert r_get.status_code == 404, f"Monitor should be deleted but GET returned {r_get.status_code}"

        # Verify diffs endpoint returns 404 for deleted monitor
        r_diffs = requests.get(f"{BASE_URL}/api/monitors/{monitor_id}/diffs", headers=headers, timeout=TIMEOUT)
        assert r_diffs.status_code == 404, f"Diffs should not be available for deleted monitor but got {r_diffs.status_code}"

    finally:
        # Clean up user account which cascades all user data per PRD
        delete_user(token)

test_deleteapimonitorsiddeletesmonitorandrelateddata()