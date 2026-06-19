#!/bin/sh
export PGPASSWORD=testpass
psql -h 172.18.0.3 -U dtfm_user -d dtfm_db -c "SELECT 1" 2>&1
echo "exit code: $?"
