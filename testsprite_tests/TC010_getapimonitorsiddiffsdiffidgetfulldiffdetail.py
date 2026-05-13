import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30


def test_get_api_monitors_id_diffs_diffId_get_full_diff_detail():
    """
    Test retrieving full diff detail including snapshot metadata and diff data for a specific diff of a monitor.
    Verify response 200 with diff and monitor objects or 404 if diff not found.
    """
    # Helper to register user and get token
    def register_user():
        email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
        password = "password123"
        name = "Test User"
        payload = {
            "email": email,
            "password": password,
            "name": name,
            "plan": "pro"  # pro plan to enable possible diff generation
        }
        resp = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()["token"]

    # Helper to create a new monitor, returns monitor id
    def create_monitor(token):
        payload = {
            "name": "Test Monitor",
            "url": "https://www.example.com",
            "checkIntervalMinutes": 60,
            "threshold": 0.01
        }
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(f"{BASE_URL}/api/monitors", json=payload, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()["monitor"]["id"]

    # Helper to get diffs list; returns first diff id if exists
    def get_first_diff_id(token, monitor_id):
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/monitors/{monitor_id}/diffs", headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        diffs = resp.json().get("diffs", [])
        if not diffs:
            return None
        return diffs[0]["id"]

    # Helper to delete monitor
    def delete_monitor(token, monitor_id):
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.delete(f"{BASE_URL}/api/monitors/{monitor_id}", headers=headers, timeout=TIMEOUT)
        if resp.status_code not in (200, 404):
            resp.raise_for_status()

    token = None
    monitor_id = None

    try:
        # Register user and get auth token
        token = register_user()
        headers = {"Authorization": f"Bearer {token}"}

        # Create a monitor to get diffs from
        monitor_id = create_monitor(token)

        # It may take some time for diffs to be created by backend scrapers,
        # so we poll diffs endpoint up to some timeout to get a diffId
        diff_id = None
        import time

        for _ in range(10):
            diff_id = get_first_diff_id(token, monitor_id)
            if diff_id:
                break
            time.sleep(3)

        # If no diff exists yet, this is an edge case; test 404 for that diffId
        if not diff_id:
            # Use a made-up diffId to test 404 response
            diff_id = str(uuid.uuid4())

            resp = requests.get(
                f"{BASE_URL}/api/monitors/{monitor_id}/diffs/{diff_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            assert resp.status_code == 404
            assert "error" in resp.json()
            assert resp.json()["error"].lower() == "diff not found"
            return

        # Retrieve full diff detail for the existing diffId
        resp = requests.get(
            f"{BASE_URL}/api/monitors/{monitor_id}/diffs/{diff_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200

        body = resp.json()
        assert "diff" in body and isinstance(body["diff"], dict)
        assert "monitor" in body and isinstance(body["monitor"], dict)

    finally:
        if token and monitor_id:
            try:
                delete_monitor(token, monitor_id)
            except Exception:
                pass


test_get_api_monitors_id_diffs_diffId_get_full_diff_detail()