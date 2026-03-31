import os
with open('.env.dev') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#') and line:
            k, v = line.split('=', 1)
            os.environ[k] = v

import uvicorn
uvicorn.run("gateway.main:app", host="0.0.0.0", port=8000, reload=False)
