with open(r'C:\Users\sahil\Projects\Digital-Twinn\.env', 'a') as f:
    f.write('\nPOSTGRES_URL=postgresql://dtfm_user:testpass@localhost:5432/dtfm_db\n')
    f.write('REDIS_URL=redis://:***@localhost:6379/0\n')
    f.write('INGEST_API_KEY=dtfm_ingest_dev_key\n')
print('Added URL env vars to .env')
