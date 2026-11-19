#!/usr/bin/env python3
"""Smoke test for Spendly PHP/MySQL; exercises real cookies, CSRF and persistence."""
import json
import os
import uuid
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

BASE = os.getenv("SPENDLY_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
csrf = ""

def request(action, method="GET", data=None):
    url = BASE + "/api/index.php?" + urllib.parse.urlencode({"action": action})
    raw = None if data is None else json.dumps(data).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if method != "GET":
        headers["X-CSRF-Token"] = csrf
    req = urllib.request.Request(url, data=raw, headers=headers, method=method)
    try:
        with client.open(req, timeout=15) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, json.load(exc)

status, session = request("session")
assert status == 200 and session["authenticated"] is False, (status, session)
csrf = session["csrf"]
email = "ci-" + uuid.uuid4().hex[:12] + "@example.com"
password = "ValidPassword-123"

status, result = request("register", "POST", {"name": "CI Tester", "email": email, "password": password})
assert status == 201 and result["ok"], (status, result)
status, session = request("session")
assert status == 200 and session["authenticated"], (status, session)
csrf = session["csrf"]
status, record = request("data")
assert status == 200 and record["data"]["expenses"] == [], (status, record)
assert record["data"]["incomes"] == []
doc = record["data"]
doc["budget"]["total"] = 2000
doc["incomes"].append({"id": 99001, "date": "2026-11-18", "source": "Allowance", "amount": 5000})
doc["expenses"].append({"id": 99002, "date": "2026-11-18", "category": "Food", "description": "Lunch", "amount": 200})
status, saved = request("data", "PUT", {"data": doc, "version": record["version"]})
assert status == 200 and saved["version"] == record["version"] + 1, (status, saved)
status, changed = request("data")
assert status == 200 and len(changed["data"]["expenses"]) == 1
assert changed["data"]["incomes"][0]["amount"] == 5000
status, conflict = request("data", "PUT", {"data": doc, "version": record["version"]})
assert status == 409, (status, conflict)
# MySQL vault balances, movement ledger and account export.
status, vault = request("vault-create", "POST", {"name":"Tuition fund","target":2500})
assert status == 201, (status, vault)
vault_id = vault["id"]
assert request("vault-action","POST",{"id":vault_id,"kind":"deposit","amount":500,"note":"Allowance"})[0] == 200
assert request("vault-action","POST",{"id":vault_id,"kind":"withdraw","amount":100})[0] == 200
status, vault_list = request("vaults")
assert status == 200 and vault_list["vaults"][0]["current_balance"] == 400
assert request("reset-data","POST",{})[0] == 409
assert request("vault-action","POST",{"id":vault_id,"kind":"withdraw","amount":400})[0] == 200
assert request("vault-archive","POST",{"id":vault_id})[0] == 200
status, exported = request("export-account")
assert status == 200 and len(exported["vaults"][0]["transactions"]) == 3
new_email = "updated-" + email
assert request("change-email","POST",{"current":password,"email":new_email})[0] == 200
status, changed_account = request("data")
assert status == 200 and changed_account["data"]["profile"]["email"] == new_email
email = new_email
status, logged_out = request("logout", "POST", {})
assert status == 200
status, denied = request("data")
assert status == 401, (status, denied)
status, session = request("session")
assert status == 200 and not session["authenticated"]
csrf = session["csrf"]
status, bad = request("login", "POST", {"email": email, "password": "wrong"})
assert status == 401
status, ok = request("login", "POST", {"email": email, "password": password})
assert status == 200 and ok["ok"], (status, ok)
status, session = request("session")
csrf = session["csrf"]
status, again = request("data")
assert status == 200 and len(again["data"]["expenses"]) == 1
status, changed_pw = request("change-password", "POST", {"current": password, "password": "NewPassword-456"})
assert status == 200
status, reset = request("reset-data", "POST", {})
assert status == 200
status, cleared = request("data")
assert status == 200 and cleared["data"]["expenses"] == [] and cleared["data"]["incomes"] == []
print("Spendly smoke tests passed: registration, relational persistence, vaults, account email, logout, password and reset")
