import os
import json

POSTMAN_DIR = r"d:\Project\event-platform\postman"
os.makedirs(POSTMAN_DIR, exist_ok=True)

COLLECTION_FILE = os.path.join(POSTMAN_DIR, "Event_Platform_API_Postman_Collection.json")
LOCAL_ENV_FILE = os.path.join(POSTMAN_DIR, "Event_Platform_Local_Environment.json")
PROD_ENV_FILE = os.path.join(POSTMAN_DIR, "Event_Platform_Production_Environment.json")

def generate_postman_files():
    # Postman Collection v2.1.0 Structure
    collection = {
        "info": {
            "_postman_id": "event-platform-api-collection-v1",
            "name": "Event Platform API Engine - Full Suite",
            "description": "Complete Postman Collection for Event Management, Check-in Gates, and Interactive Lucky Draw Engine API",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            # Folder 1: Auth
            {
                "name": "1. Authentication",
                "item": [
                    {
                        "name": "TC-001: Admin Login (Valid)",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "var jsonData = pm.response.json();",
                                        "if (jsonData.success && jsonData.data.token) {",
                                        "    pm.environment.set('adminToken', jsonData.data.token);",
                                        "    console.log('Saved adminToken to environment');",
                                        "}"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"username": "admin", "password": "password123"}, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/auth/login",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "auth", "login"]
                            }
                        }
                    },
                    {
                        "name": "TC-002: Reject Invalid Login",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"username": "admin", "password": "wrongpassword"}, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/auth/login",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "auth", "login"]
                            }
                        }
                    }
                ]
            },
            # Folder 2: Events
            {
                "name": "2. Event Management",
                "item": [
                    {
                        "name": "TC-003: Create New Event",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "var jsonData = pm.response.json();",
                                        "if (jsonData.success && jsonData.data.id) {",
                                        "    pm.environment.set('eventId', jsonData.data.id);",
                                        "}"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Content-Type", "value": "application/json"},
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "name": "Postman Technology Summit 2026",
                                    "description": "Annual Enterprise Software & AI Innovation Conference",
                                    "venue": "Grand Ballroom Hall A",
                                    "startDate": "2026-12-01T09:00:00.000Z",
                                    "endDate": "2026-12-01T18:00:00.000Z",
                                    "status": "ACTIVE"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/events",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "events"]
                            }
                        }
                    },
                    {
                        "name": "TC-004: Update Event Status to Active",
                        "request": {
                            "method": "PUT",
                            "header": [
                                {"key": "Content-Type", "value": "application/json"},
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"status": "ACTIVE"}, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/events/{{eventId}}",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "events", "{{eventId}}"]
                            }
                        }
                    },
                    {
                        "name": "TC-005: Get Event Detail",
                        "request": {
                            "method": "GET",
                            "header": [],
                            "url": {
                                "raw": "{{baseUrl}}/api/events/{{eventId}}",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "events", "{{eventId}}"]
                            }
                        }
                    },
                    {
                        "name": "List All Active Events",
                        "request": {
                            "method": "GET",
                            "header": [],
                            "url": {
                                "raw": "{{baseUrl}}/api/events?status=ACTIVE,PUBLISHED",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "events"],
                                "query": [{"key": "status", "value": "ACTIVE,PUBLISHED"}]
                            }
                        }
                    }
                ]
            },
            # Folder 3: Checkin Points
            {
                "name": "3. Checkin Entrance Points",
                "item": [
                    {
                        "name": "TC-006: Get Entrance Points List",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "var jsonData = pm.response.json();",
                                        "if (jsonData.success && jsonData.data.length > 0) {",
                                        "    pm.environment.set('pointId', jsonData.data[0].id);",
                                        "}"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [],
                            "url": {
                                "raw": "{{baseUrl}}/api/checkin/points?eventId={{eventId}}",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "checkin", "points"],
                                "query": [{"key": "eventId", "value": "{{eventId}}"}]
                            }
                        }
                    },
                    {
                        "name": "TC-007: Create New Entrance Gate",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "var jsonData = pm.response.json();",
                                        "if (jsonData.success && jsonData.data.id) {",
                                        "    pm.environment.set('pointId', jsonData.data.id);",
                                        "}"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Content-Type", "value": "application/json"},
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "eventId": "{{eventId}}",
                                    "name": "Main Gate Entrance 1",
                                    "location": "Lobby Main Door",
                                    "isActive": True,
                                    "sortOrder": 1
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/checkin/points",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "checkin", "points"]
                            }
                        }
                    }
                ]
            },
            # Folder 4: Registration & Checkin
            {
                "name": "4. Registration & On-Site Checkin",
                "item": [
                    {
                        "name": "TC-008: Register New Attendee",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "var jsonData = pm.response.json();",
                                        "if (jsonData.success && jsonData.data.id) {",
                                        "    pm.environment.set('registrationId', jsonData.data.id);",
                                        "}"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "eventId": "{{eventId}}",
                                    "fullName": "Somchai Jaidee (Postman Guest)",
                                    "email": "somchai.postman@example.com",
                                    "phone": "0812345678",
                                    "company": "Enterprise QA Corp",
                                    "department": "Software Engineering"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/registrations",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "registrations"]
                            }
                        }
                    },
                    {
                        "name": "TC-009: Perform Gate Check-in",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "registrationId": "{{registrationId}}",
                                    "checkinPointId": "{{pointId}}",
                                    "method": "MANUAL"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/checkin",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "checkin"]
                            }
                        }
                    }
                ]
            },
            # Folder 5: Prizes & Lucky Draw
            {
                "name": "5. Prize & Lucky Draw Engine",
                "item": [
                    {
                        "name": "TC-031: Create Prize for Event",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "var jsonData = pm.response.json();",
                                        "if (jsonData.success && jsonData.data.id) {",
                                        "    pm.environment.set('prizeId', jsonData.data.id);",
                                        "}"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Content-Type", "value": "application/json"},
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "eventId": "{{eventId}}",
                                    "name": "Grand Prize iPhone 16 Pro Max",
                                    "description": "Top Lucky Draw Prize for VIP Attendee",
                                    "quantity": 5,
                                    "sortOrder": 1
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/prizes",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "prizes"]
                            }
                        }
                    },
                    {
                        "name": "TC-032: Fetch Prizes & Eligible Candidates",
                        "request": {
                            "method": "GET",
                            "header": [],
                            "url": {
                                "raw": "{{baseUrl}}/api/prizes?eventId={{eventId}}",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "prizes"],
                                "query": [{"key": "eventId", "value": "{{eventId}}"}]
                            }
                        }
                    },
                    {
                        "name": "TC-033: Start Lucky Draw Session",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "var jsonData = pm.response.json();",
                                        "if (jsonData.success && jsonData.data.id) {",
                                        "    pm.environment.set('drawSessionId', jsonData.data.id);",
                                        "}"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Content-Type", "value": "application/json"},
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "eventId": "{{eventId}}",
                                    "prizeId": "{{prizeId}}",
                                    "drawCount": 1
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/draws/start",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "draws", "start"]
                            }
                        }
                    },
                    {
                        "name": "TC-034: Execute Spin Fisher-Yates Draw",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.sendRequest({",
                                        "    url: pm.environment.get('baseUrl') + '/api/draws/' + pm.environment.get('drawSessionId'),",
                                        "    method: 'GET'",
                                        "}, function (err, res) {",
                                        "    var sData = res.json();",
                                        "    if (sData.success && sData.data.winners && sData.data.winners.length > 0) {",
                                        "        pm.environment.set('winnerId', sData.data.winners[0].id);",
                                        "    }",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"count": 1}, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/draws/{{drawSessionId}}/spin",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "draws", "{{drawSessionId}}", "spin"]
                            }
                        }
                    }
                ]
            },
            # Folder 6: Winner Management
            {
                "name": "6. Winner Status Management",
                "item": [
                    {
                        "name": "TC-035: Update Winner Status to ACCEPTED",
                        "request": {
                            "method": "PUT",
                            "header": [
                                {"key": "Content-Type", "value": "application/json"},
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"status": "ACCEPTED"}, indent=2)
                            },
                            "url": {
                                "raw": "{{baseUrl}}/api/draws/winners/{{winnerId}}",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "draws", "winners", "{{winnerId}}"]
                            }
                        }
                    },
                    {
                        "name": "TC-036: Delete Winner & Recalculate Quota",
                        "request": {
                            "method": "DELETE",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                            ],
                            "url": {
                                "raw": "{{baseUrl}}/api/draws/winners/{{winnerId}}",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "draws", "winners", "{{winnerId}}"]
                            }
                        }
                    }
                ]
            }
        ]
    }

    # Postman Local Environment File
    local_env = {
        "id": "event-platform-local-env",
        "name": "Event Platform - Local Environment",
        "values": [
            {"key": "baseUrl", "value": "http://localhost:4000", "enabled": True},
            {"key": "adminToken", "value": "", "enabled": True},
            {"key": "eventId", "value": "", "enabled": True},
            {"key": "pointId", "value": "", "enabled": True},
            {"key": "registrationId", "value": "", "enabled": True},
            {"key": "prizeId", "value": "", "enabled": True},
            {"key": "drawSessionId", "value": "", "enabled": True},
            {"key": "winnerId", "value": "", "enabled": True}
        ],
        "_postman_variable_scope": "environment"
    }

    # Postman Production Environment File
    prod_env = {
        "id": "event-platform-prod-env",
        "name": "Event Platform - Production Environment",
        "values": [
            {"key": "baseUrl", "value": "https://event-platform-api.onrender.com", "enabled": True},
            {"key": "adminToken", "value": "", "enabled": True},
            {"key": "eventId", "value": "", "enabled": True},
            {"key": "pointId", "value": "", "enabled": True},
            {"key": "registrationId", "value": "", "enabled": True},
            {"key": "prizeId", "value": "", "enabled": True},
            {"key": "drawSessionId", "value": "", "enabled": True},
            {"key": "winnerId", "value": "", "enabled": True}
        ],
        "_postman_variable_scope": "environment"
    }

    with open(COLLECTION_FILE, 'w', encoding='utf-8') as f:
        json.dump(collection, f, indent=2, ensure_ascii=False)

    with open(LOCAL_ENV_FILE, 'w', encoding='utf-8') as f:
        json.dump(local_env, f, indent=2, ensure_ascii=False)

    with open(PROD_ENV_FILE, 'w', encoding='utf-8') as f:
        json.dump(prod_env, f, indent=2, ensure_ascii=False)

    print(f"Postman Collection generated: {COLLECTION_FILE}")
    print(f"Local Environment generated: {LOCAL_ENV_FILE}")
    print(f"Production Environment generated: {PROD_ENV_FILE}")

if __name__ == "__main__":
    generate_postman_files()
