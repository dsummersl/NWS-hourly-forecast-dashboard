import json
import os
import sys

enabled = os.environ.get("TEST_MODE", "").lower() in ("1", "true", "yes")
json.dump(enabled, sys.stdout)